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
  const exploded = processed
    .flatMap((d) => Array(Math.round(d.count / numPerDot)).fill(d))
    .filter((d) => regions.includes(d.BPL_REGION))
    .map((d, i) => ({
      i,
      ...d
    }))
  return { exploded, regions };
}


export class Dots {
  constructor({
    selector = "figure.intro-dots",
    circleRadius = 2.5,
    circlePadding = 1,
    emitter
  } = {}) {
    this.figure = document.querySelector(selector)
    this.emitter = emitter

    this.circleRadius = circleRadius
    this.circlePadding = circlePadding;

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
      .append("svg")
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
    this.data = await prepareData();
  }

  resize() {
    const { width, height } = this.figure.getBoundingClientRect()
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
    this.numCols = Math.floor(innerWidth / (2 * this.circleRadius + 2 * this.circlePadding))
  }

  calculateData() {
    let { selectedRegion } = this.userRegions;
    // let selectedRegion = null;
    console.log("Regenerating data");
    let filtered = this.data.exploded;
    let grouper = this.groupby;
    if (selectedRegion) {
      filtered = this.data.exploded.filter((d) => d.BPL_REGION === selectedRegion);
      grouper = (d) => d.BPL_COUNTRY;
    }
    let group = d3.group(filtered, grouper);
    group = new Map(
      Array.from(group.entries()).sort((a, b) =>
        d3.descending(a[1].length, b[1].length)
      )
    );
    const groupCounter = new Map();
    const groupOffsets = Array.from(
      d3.cumsum(
        Array.from(group.values())
          .sort((a, b) => d3.descending(a.length, b.length))
          .map(
            (array) =>
              (Math.ceil(array.length / this.numCols) + 1) *
              (2 * this.circleRadius + 2 * this.circlePadding)
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
    let { data, group, offsets } = this.calculateData();

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
            .style("top", (_, i) => offsets[i])
            .style("margin-top", this.margin.top - 2 * this.circleRadius - 2 * this.circlePadding),
        (update) =>
          update.call((update) =>
            update
              .text((d) => d[0].toLowerCase())
              .style("left", (d) => -10)
              .style("top", (_, i) => offsets[i])
          )
      );
  }
}
