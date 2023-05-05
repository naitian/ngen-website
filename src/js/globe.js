import * as d3 from "d3";
import * as topojson from "topojson";
import { rewind } from "./rewind"

import world from "../assets/world_countries_2020.json"


const prepareData = async () => {
  const map_countries = await d3.csv(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_2SDYfhN9ZOX3XQ5MhsVMM5Aj8dsvB0hWuMDgwNX_GHxZwxbvRZa2X1m9O5dAJLpiKtlfHX3BFxiV/pub?gid=96360562&single=true&output=csv"
  )

  const outline = ({ type: "Sphere" })
  const land = topojson.merge(world, world.objects.world_countries_2020.geometries)

  const topocountries = world.objects.world_countries_2020.geometries.map((d) => {
    const properties = {
      ...d.properties,
      Region: map_countries.find((v) => v.Country === d.properties.CNTRY_NAME)
        ?.Region
    };
    return {
      ...d,
      properties
    };
  })

  const regions = new Map(
    d3
      .groups(topocountries, (d) => d.properties.Region)
      .map((d) => [
        d[0],
        d[0] !== "OTHER NORTH AMERICA"
          ? rewind(topojson.merge(world, d[1]))
          : topojson.merge(world, d[1])
      ])
  )
  return {
    outline, land, regions
  }
}

export class Globe {
  constructor({
    selector = "canvas.globe-canvas",
    defaultRotate = 1,
    colors = {
      land: "#ccc",
      hover: "#eee",
      select: "#0F05"
    },
    emitter,
  } = {}) {

    this.canvas = document.querySelector(selector);
    this.context = this.canvas.getContext("2d")

    this.inset = 5;

    this.scaling = 2;

    this.rotate = 0;
    this.defaultRotate = defaultRotate;
    this.autoRotate = defaultRotate;

    this.data = null
    this.colors = colors

    this.loadData = this.loadData.bind(this)
    this.setup = this.setup.bind(this)
    this.findContinent = this.findContinent.bind(this)
    this.render = this.render.bind(this)
    this.resize = this.resize.bind(this)

    this.selectedRegion = null;
    this.hoverRegion = null;

    this.emitter = emitter;

    this.setup()
  }

  async loadData() {
    if (this.data) return
    this.data = await prepareData()
  }

  async setup() {
    await this.loadData()
    this.setupHandlers()
    this.resize()
    this.render()
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.width = width;
    this.height = height;

    [this.globeWidth, this.globeHeight] = [this.width * this.scaling, this.height * this.scaling];
    this.canvas.width = this.globeWidth;
    this.canvas.height = this.globeHeight;

    // FIXME: recalculate projection on window resize
    this.projection = d3.geoOrthographic().fitExtent(
      [
        [this.inset, this.inset],
        [this.globeWidth - this.inset, this.globeHeight - this.inset]
      ],
      this.data.outline
    );

    this.path = d3.geoPath(this.projection, this.context);
  }

  setupHandlers() {
    const drag = d3
      .drag()
      .on("start", () => {
        this.autoRotate = 0;
      })
      .on("drag", ({ dx }) => {
        this.rotate += dx;
      })
      .on("end", () => {
        // this.autoRotate = this.defaultRotate;
      });
    const click = (e) => {
      if (e.defaultPrevented) return;
      const [clientX, clientY] = d3.pointer(e);
      const clickPoint = this.projection.invert([clientX * this.scaling, clientY * this.scaling]);

      this.emitter.emit("select-region", {
        hoverRegion: this.hoverRegion,
        selectedRegion: this.findContinent(clickPoint),
      })
    };
    const hover = (e) => {
      if (e.defaultPrevented) return;
      const [clientX, clientY] = d3.pointer(e);
      const clickPoint = this.projection.invert([clientX * this.scaling, clientY * this.scaling]);
      this.autoRotate = 1 / 8;

      this.emitter.emit("hover-region", {
        hoverRegion: this.findContinent(clickPoint),
        selectedRegion: this.selectedRegion,
      })
    };
    const unhover = () => {
      this.emitter.emit("hover-region", {
        hoverRegion: null,
        selectedRegion: this.selectedRegion,
      })
      this.autoRotate = this.defaultRotate;
    }
    d3.select(this.canvas)
      .call(drag)
      .on("click", click)
      .on("pointermove", hover)
      .on("pointerout", unhover)

    this.emitter.on("hover-region", ({ hoverRegion }) => {
      this.hoverRegion = hoverRegion;
    })
    this.emitter.on("select-region", ({ selectedRegion }) => {
      this.selectedRegion = selectedRegion;
    })
  }



  findContinent(coords) {
    if (!d3.geoContains(this.data.land, coords)) {
      return null;
    }
    for (let [region, geojson] of this.data.regions) {
      if (d3.geoContains(geojson, coords) && region !== "UNITED STATES") {
        return region;
      }
    }
    return null;
  };

  async render() {
    this.projection.rotate([(this.rotate += this.autoRotate / 4), -15, -23]);

    this.context.clearRect(0, 0, this.globeWidth, this.globeHeight);

    // Draw land
    this.context.beginPath(),
      this.path(this.data.land),
      (this.context.fillStyle = this.colors.land),
      this.context.fill();

    // invalidate US
    this.context.beginPath(),
      this.path(this.data.regions.get("UNITED STATES")),
      (this.context.fillStyle = "#eee"),
      this.context.fill(),
      this.context.closePath();


    // draw hover region
    this.context.beginPath(),
      this.path(this.data.regions.get(this.hoverRegion)),
      (this.context.fillStyle = this.colors.hover),
      this.context.fill(),
      (this.context.strokeStyle = "#000"),
      (this.context.lineWidth = 1.5),
      this.context.stroke(),
      this.context.closePath();

    // draw selected region
    this.context.beginPath(),
      this.path(this.data.regions.get(this.selectedRegion)),
      (this.context.fillStyle = this.colors.select),
      this.context.fill();

    // Draw outline
    this.context.beginPath(),
      this.path(this.data.outline),
      (this.context.strokeStyle = "#000"),
      (this.context.lineWidth = 1.5),
      this.context.stroke();

    requestAnimationFrame(this.render)
  }
}
