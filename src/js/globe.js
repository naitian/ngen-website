import * as d3 from "d3";
import * as topojson from "topojson";
import {rewind} from "./rewind"

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

export const drawGlobe = async ({ defaultRotate = 1 } = {}) => {
  const canvas = document.querySelector("canvas.globe-canvas");
  const context = canvas.getContext("2d")

  const inset = 5;
  const {width, height} = canvas.getBoundingClientRect();
  const scaling = 2;

  let rotate = 0;
  let autoRotate = defaultRotate;


  const { outline, land, regions } = await prepareData()

  const [globeWidth, globeHeight] = [width * scaling, height * scaling];
  canvas.width = globeWidth;
  canvas.height = globeHeight;

  // FIXME: recalculate projection on window resize
  const projection = d3.geoOrthographic().fitExtent(
    [
      [inset, inset],
      [globeWidth - inset, globeHeight - inset]
    ],
    outline
  );
  const path = d3.geoPath(projection, context);

  const findContinent = (coords) => {
    if (!d3.geoContains(land, coords)) {
      return null;
    }
    for (let [region, geojson] of regions) {
      if (d3.geoContains(geojson, coords) && region !== "UNITED STATES") {
        return region;
      }
    }
    return null;
  };

  const drag = d3
    .drag()
    .on("start", () => {
      autoRotate = 0;
    })
    .on("drag", ({ dx }) => {
      rotate += dx;
    })
    .on("end", () => {
      autoRotate = defaultRotate;
    });

  let selectedRegion = null;
  let hoverRegion = null;

  const click = (e) => {
    if (e.defaultPrevented) return;
    const [clientX, clientY] = d3.pointer(e);
    const clickPoint = projection.invert([clientX * scaling, clientY * scaling]);
    selectedRegion = findContinent(clickPoint);
  };
  const hover = (e) => {
    if (e.defaultPrevented) return;
    const [clientX, clientY] = d3.pointer(e);
    const clickPoint = projection.invert([clientX * scaling, clientY * scaling]);
    hoverRegion = findContinent(clickPoint);
    autoRotate = 1 / 8;
  };
  const unhover = (e) => {
    hoverRegion = null;
    autoRotate = defaultRotate;
  }

  d3.select(canvas)
    .call(drag)
    .on("click", click)
    .on("pointermove", hover)
    .on("pointerout", unhover)

  const render = () => {
    projection.rotate([(rotate += autoRotate / 4), -15, -23]);

    context.clearRect(0, 0, globeWidth, globeHeight);

    // Draw land
    context.beginPath(),
    path(land),
    (context.fillStyle = "#ccc"),
    context.fill();

    // draw hover region
    context.beginPath(),
      path(regions.get(hoverRegion)),
      (context.fillStyle = "#eee"),
      context.fill(),
      context.closePath();

    // draw selected region
    context.beginPath(),
      path(regions.get(selectedRegion)),
      (context.fillStyle = "#0F05"),
      context.fill();

    // Draw outline
    context.beginPath(),
    path(outline),
    (context.strokeStyle = "#000"),
    (context.lineWidth = 1.5),
    context.stroke();

    requestAnimationFrame(render)
  }

  render()

}

