import * as d3 from "d3";


const prepareData = async () => {
  const data = await d3.csv(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_2SDYfhN9ZOX3XQ5MhsVMM5Aj8dsvB0hWuMDgwNX_GHxZwxbvRZa2X1m9O5dAJLpiKtlfHX3BFxiV/pub?gid=1622878989&single=true&output=csv"
  )
  return data
}

export class JobChart {
  constructor({ selector = "figure.occupation-chart", emitter } = {}) {
    this.figure = document.querySelector(selector)

    this.emitter = emitter
    this.genInd = 0;

    this.generations = [
      "First",
      // "One and a half",
      "Second",
      "Third or later",
      "Population"
    ]

    this.collars = [
      "Blue Collar",
      "White Collar",
      "Other",
    ]

    this.colorScale = d3.scaleOrdinal()
      .domain(this.collars)
      .range(["#002051", "#FFFEF2", "#eee"])

    this.setup.bind(this)
    this.loadData.bind(this)
    this.resize.bind(this)
    this.renderSmallMultiple.bind(this)
    this.render.bind(this)

    this.setup()
  }

  async setup() {
    await this.loadData();

    this.resize()
    this.render()
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
  }

  async loadData() {
    if (this.data) return;
    this.data = await prepareData();
  }

  renderSmallMultiple(d, i, e) {
    const data = d;
    const svg = d3.select(e[i])

    const groupingFns = [(d) => d.OCC_COLLAR, (d) => d.OCC_MG, (d) => d.OCC_STR]
    const reduceFn = (iterable) => d3.sum(iterable, (d) => +d.ASECWT)
    const rollupData = d3.rollup(data, reduceFn, ...groupingFns)

    const childrenAccessorFn = ([_, value]) => value.size && Array.from(value)

    const hierarchyData = d3
      .hierarchy([null, rollupData], childrenAccessorFn)
      .sum(([_, value]) => value)
      .sort((a, b) => b.value - a.value)

    const g = svg.selectAll("g").data([0]).join("g")
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)

    const treemap = d3.treemap().size([
      svg.attr("width") - this.margin.left - this.margin.right,
      svg.attr("height") - this.margin.top - this.margin.bottom
    ]).paddingInner(0.5)

    treemap(hierarchyData)
    const figure = this.figure
    const tooltip = this.tooltip
    g.selectAll("rect").data(hierarchyData.leaves())
      .join("rect")
      .attr("transform", d => `translate(${d.x0}, ${d.y0})`)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => this.colorScale(d.parent.parent.data[0]))
      .attr("stroke-width", 0.1)
      .attr("stroke", d => d.parent.parent.data[0] === "White Collar" ? "black" : "white")
      .on("mouseover", function (e, d) {
        const [x, y] = d3.pointer(e, figure);
        console.log(d)
        tooltip
          .style("left", x)
          .style("top", y)
          .style("visibility", "visible")
          .style("z-index", 10)
          .text(d.data[0])
        d3.select(this).attr("stroke-width", 1)
      })
      .on("mousemove", function (e, d) {
        const [x, y] = d3.pointer(e, figure);
        tooltip
          .style("left", x + 5)
          .style("top", y + 5)
          .style("visibility", "visible")
          .style("z-index", 10)
          .text(d.data[0])

        d3.select(this).attr("stroke-width", 1)
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 0.1)
        tooltip
          .style("visibility", "hidden")
      })


    const total = d3.sum(hierarchyData.children.map(d => d.value))
    const pctFmt = d3.format(".0%")
    g.selectAll("text").data(hierarchyData.children)
      .join("text")
      .attr("x", d => (d.x0 + d.x1) / 2)
      .attr("y", d => (d.y0 + d.y1) / 2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "middle")
      .attr("stroke", "white")
      .attr("stroke-width", 4)
      .attr("paint-order", "stroke")
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none")
      .text(d => `${d.data[0]} (${pctFmt(d.value / total)})`)
  }


  render() {
    const groups = d3.group(this.data, d => d.GEN)

    this.tooltip = d3.select(this.figure)
      .selectAll("div.tooltip")
      .data([0])
      .join("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")

    const wrappers = d3.select(this.figure)
      .selectAll("div.wrapper")
      .data(this.generations.map(d => groups.get(d)))
      .join("div")
      .attr("class", "wrapper")

    wrappers.append("svg")
      .attr("width", this.width / 2)
      .attr("height", this.width / 2)
      .each(this.renderSmallMultiple.bind(this))

    wrappers.append("span").text((_, i) => this.generations[i])
  }

}
