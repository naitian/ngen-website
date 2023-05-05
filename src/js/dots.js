import * as d3 from "d3";


const prepareData = async (numPerDot = 10000) => {
  const data = await d3.csv(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_2SDYfhN9ZOX3XQ5MhsVMM5Aj8dsvB0hWuMDgwNX_GHxZwxbvRZa2X1m9O5dAJLpiKtlfHX3BFxiV/pub?output=csv"
  )
  const processed = data
    .map((d) => ({
      ...d,
      count: Math.round(+d.ASECWT),
      year: new Date(+d.YRIMMIG, 0, 1),
      YRIMMIG: +d.YRIMMIG
    }))
    .filter((d) => d.BPL_REGION !== "UNITED STATES")
    .filter((d) => ["First", "One and a half"].includes(d.GEN))
    .filter((d) => d.YRIMMIG !== 0)
  const regions = [
    "AFRICA",
    "AMERICAS",
    "ASIA",
    "CARIBBEAN",
    "CENTRAL AMERICA",
    "EUROPE",
    "OCEANIA",
    "OTHER NORTH AMERICA",
    "SOUTH AMERICA"
  ]
  const regionCounts = new Map(d3.groups(processed, (d) => d.BPL_REGION)
    .map((d) => [d[0], d[1].reduce((a, b) => a + b.count, 0)]))

  const exploded = processed
    .flatMap((d) => Array(Math.round(d.count / numPerDot)).fill(d))
    .filter((d) => regions.includes(d.BPL_REGION))
    .map((d, i) => ({
      i,
      ...d
    }))
  return { exploded, regions, regionCounts };
}


export class Dots {
  constructor({
    selector = "figure.intro-dots",
    captionSelector = ".dots-container .caption",
    circleRadius = 2.5,
    circlePadding = 1,
    groupPadding = 10,
    emitter
  } = {}) {

    this.captionTemplate = (numPeople, region) => {
      const regionMap = {
        AFRICA: "Africa",
        ASIA: "Asia",
        CARIBBEAN: "Caribbean",
        "CENTRAL AMERICA": "Central America",
        EUROPE: "Europe",
        OCEANIA: "Oceania",
        "OTHER NORTH AMERICA": "North America (excluding the U.S.)",
        "SOUTH AMERICA": "South America",
        null: "another country"
     }
      const fmt = new Intl.NumberFormat("en-US", {notation: "compact", compactDisplay: "long"})
      return `In 2022, there were <b>${fmt.format(numPeople)}</b> people living in the United States who moved there from <b>${regionMap[region]}</b>.`
    }

    this.figure = document.querySelector(selector)
    this.captionEl = document.querySelector(captionSelector)
    this.emitter = emitter

    this.circleRadius = circleRadius
    this.circlePadding = circlePadding
    this.groupPadding = groupPadding

    this.userRegions = {
      hoverRegion: null,
      selectedRegion: null
    }
    this.groupby = (d) => d.BPL_REGION

    this.resize = this.resize.bind(this)
    this.setup = this.setup.bind(this)
    this.render = this.render.bind(this)

    this.setup()
  }

  async setup() {
    await this.loadData()
    this.resize()
    this.svg = d3.select(this.figure)
      .select("svg")
      .attr("width", this.width)
      .attr("height", this.height)
    this.figure.append(this.svg.node())

    this.emitter.on("select-region", (userRegions) => {
      console.log(userRegions)
      this.userRegions = userRegions;
      this.render();
    })

    this.render()
  }

  async loadData() {
    if (this.data) return;
    this.data = await prepareData(10000);
  }

  resize() {
    const { width, height } = this.figure.getBoundingClientRect()
    console.log(width, height)
    this.margin = {
      top: 15,
      right: 15,
      bottom: 15,
      left: 15,
    }
    this.width = width;
    this.height = height;
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;
    this.numCols = Math.floor(this.innerWidth / (2 * this.circleRadius + 2 * this.circlePadding))
  }

  calculateData() {
    let { selectedRegion } = this.userRegions;
    // let selectedRegion = null;
    console.log("Regenerating data");
    let filtered = this.data.exploded;
    let groupKey = "BPL_REGION"
    let k = 5;
    if (selectedRegion) {
      filtered = this.data.exploded.filter((d) => d.BPL_REGION === selectedRegion);
      groupKey = "BPL_COUNTRY";
      k = 10;
    }
    const grouper = (d) => d[groupKey];
    let group = d3.group(filtered, grouper);
    const topk = Array.from(group.entries())
      .sort((a, b) => d3.descending(a[1].length, b[1].length))
      .slice(0, k);

    filtered = filtered.map((d) => {
      if (topk.map((d) => d[0]).includes(grouper(d))) {
        return d;
      } else {
        return {
          ...d,
          [groupKey]: "Other"
        };
      }
    })
    group = d3.group(filtered, grouper);

    group = new Map(
      Array.from(group.entries()).sort((a, b) =>
        {
          if (a[0] === "Other") {
            return 1;
          } else if (b[0] === "Other") {
            return -1;
          }
          return d3.descending(a[1].length, b[1].length)
        }
      )
    );
    const groupCounter = new Map();
    const groupOffsets = Array.from(
      d3.cumsum(
        Array.from(group.values())
          .map(
            (array) =>
              (Math.ceil(array.length / this.numCols) + 1) *
              (2 * this.circleRadius + 2 * this.circlePadding) + this.groupPadding
          )
      )
    );
    groupOffsets.splice(0, 0, 0);
    const circleData = filtered.map((d) => {
      let nodeInd = groupCounter.get(grouper(d)) || 0;
      groupCounter.set(grouper(d), nodeInd + 1);

      let offsetInd = Array.from(group.keys()).indexOf(grouper(d));
      return {
        offsetInd,
        groupOffsets,
        x: (nodeInd % this.numCols) * (2 * this.circleRadius + 2 * this.circlePadding),
        y:
          Math.floor(nodeInd / this.numCols) * (2 * this.circleRadius + 2 * this.circlePadding) +
          groupOffsets[offsetInd],
        datum: d
      };
    });
    return { data: circleData, group, offsets: groupOffsets };
  }

  render() {
    let { hoverRegion, selectedRegion } = this.userRegions;
    let { regionCounts } = this.data;
    let { data, group, offsets } = this.calculateData();

    console.log(this.captionEl)
    if (selectedRegion) {
      console.log(regionCounts[selectedRegion])
      d3.select(this.captionEl).html(
        this.captionTemplate(regionCounts.get(selectedRegion), selectedRegion)
      )
    } else {
      d3.select(this.captionEl).html(
        this.captionTemplate(46e6, null)
      )
    }

    const plot = this.svg;
    const g = plot
      .selectAll("g")
      .data([0])
      .join("g")
      .style("transform", `translate(${this.margin.left}px, ${this.margin.top}px)`);

    g.selectAll("circle")
      .data(data, (d) => d.datum.i)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("r", this.circleRadius)
            .attr("cx", 0)
            .attr("cy", (d) => d.y)
            .transition().duration(200)
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y),
        (update) =>
          update.call((update) =>
            update
              .attr("r", this.circleRadius)
              .transition()
              .duration(200)
              .attr("cx", (d) => d.x)
              .attr("cy", (d) => d.y)
          )
      )
      .attr("fill", (d) =>
        d.datum.BPL_REGION === selectedRegion
          ? "green"
          : d.datum.BPL_REGION === hoverRegion
            ? "#ccc"
            : "black"
      );

    // Draw labels
    d3.select(this.figure).selectAll("span")
      .data(Array.from(group), (_, i) => i)
      .join(
        (enter) =>
          enter
            .append("span")
            .text((d) => d[0].toLowerCase())
            .style("top", (_, i) => offsets[i] + this.margin.top),
        // .style("margin-top", this.margin.top - 2 * this.circleRadius - 2 * this.circlePadding),
        (update) =>
          update.call((update) =>
            update
              .text((d) => d[0].toLowerCase())
              // .style("left", (d) => -10)
              .style("top", (_, i) => offsets[i] + this.margin.top)
          )
      );
  }
}
