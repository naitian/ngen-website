import * as d3 from "d3";

const forceRelax = function() {
  // only works in one dimension
  let valueFn = (d) => d;
  let radius = 16;
  let iterations = 100;

  function argsort(arr, fn) {
    return arr
      .map((item, index) => [item, index])
      .sort((a, b) => fn(a[0], b[0]))
      .map((d) => d[1]);
  }

  function sim(data) {
    const nodes = data.map((d) => ({ fx: 0, y: sim.value()(d) }));
    const force = d3
      .forceSimulation(nodes)
      .force("collide", d3.forceCollide(sim.radius() / 2).strength(2))
      .force("freezedim", d3.forceX(0))
      .force("stayclose", d3.forceY((d) => d.y).strength(1))
      .stop();

    for (let i = 0; i < sim.iterations(); ++i) force.tick();

    // fix order if we need to
    const orderedValues = nodes.sort((a, b) => d3.ascending(a.y, b.y));
    const sortedDataIndices = argsort(data, (a, b) =>
      d3.ascending(sim.value()(a), sim.value()(b))
    );

    return sortedDataIndices.map((idx, sortedIdx) => ({
      ...data[idx],
      relaxed: orderedValues[sortedIdx].y
    }));
  }

  sim.value = function(value) {
    if (!arguments.length) return valueFn;
    valueFn = value;
    return sim;
  };

  sim.radius = function(value) {
    if (!arguments.length) return radius;
    radius = value;
    return sim;
  };

  sim.iterations = function(value) {
    if (!arguments.length) return iterations;
    iterations = value;
    return sim;
  };

  return sim;
}

const prepareData = async () => {
  const data = await d3.csv(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_2SDYfhN9ZOX3XQ5MhsVMM5Aj8dsvB0hWuMDgwNX_GHxZwxbvRZa2X1m9O5dAJLpiKtlfHX3BFxiV/pub?gid=855946517&single=true&output=csv"
  )
  console.log(data)
  return data
}

export class EducationChart {
  constructor({ selector = "figure.education-chart", emitter } = {}) {
    this.figure = document.querySelector(selector)


    this.generations = [
      "First", "Second", "Third or later", "Population"
    ]
    this.educLevels = [
      // "less than primary",
      "primary",
      "secondary",
      "postsecondary",
      "postgrad",
    ]

    this.emitter = emitter

    this.genInd = 0;

    this.setup.bind(this)
    this.loadData.bind(this)
    this.resize.bind(this)
    this.render.bind(this)

    this.setup()
  }

  async setup() {
    await this.loadData();

    this.resize()
    this.emitter.on("set-slice", (d) => {
      this.genInd = d;
      this.render()
    })
    this.render()
  }

  resize() {
    const { width, height } = this.figure.getBoundingClientRect()
    this.margin = {
      top: 15,
      right: 70,
      bottom: 20,
      left: 60,
    }
    this.width = width;
    this.height = height;
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this.xScale = d3.scalePoint()
      .padding(0.2)
      .domain(this.educLevels)
      .range([0, this.innerWidth])

    this.yScale = d3.scaleLinear()
      .domain([0, 1])  // from 0% to 50%
      .range([this.innerHeight, 0])

    this.colorScale = d3.scaleOrdinal()
      .domain(this.generations)
      // .range(["#002051", "#7f7c75", "#fdea45", "#999"])
      .range(["#23171B", "#16B686", "#FEB927", "#900C00"])
  }

  async loadData() {
    if (this.data) return;
    this.data = await prepareData();
  }


  render() {

    const genSlice = this.generations.slice(0, this.genInd)
    const genFocus = this.generations[this.genInd - 1]
    const slice = this.data.filter(d => genSlice.includes(d.GEN))

    const svg = d3.select(this.figure)
      .selectAll("svg")
      .data([0])
      .join("svg")
      .attr("width", this.width)
      .attr("height", this.height)

    const g = svg.selectAll("g").data([0]).join("g")
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)

    const genGroups = d3.groups(slice, d => d.GEN)
    console.log(genGroups)
    const line = d3.line()
      .x(d => this.xScale(d.EDUC_GRP))
      .y(d => this.yScale(+d.CUM_WT))

    const lines = g.selectAll("path")
      .data(genGroups.map(d => [d[0], d[1].sort((a, b) => d3.ascending(
        this.educLevels.indexOf(a.EDUC_GRP),
        this.educLevels.indexOf(b.EDUC_GRP),
      ))]))
      .join((enter) =>
        enter.append("path")
      .each(d => console.log(d))
          .attr("d", d => line(d[1].map(d => ({ ...d, CUM_WT: 0 }))))
          .attr("stroke", d => this.colorScale(d[0]))
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", "8 4")
          .attr("fill", "none")
          .attr("opacity", (d) => d[0] === genFocus ? 0.8 : 0.2)
          .transition().duration(200)
          .attr("d", d => line(d[1])),
        (update) => update
          .attr("opacity", (d) => d[0] === genFocus ? 0.8 : 0.2)
      )

    const relax = forceRelax().value(d => this.yScale(d[1][d[1].length - 1].CUM_WT))

    const labels = g.selectAll("text.label")
      .data(relax(genGroups.map(d => [d[0], d[1].sort((a, b) => d3.ascending(
        this.educLevels.indexOf(a.EDUC_GRP),
        this.educLevels.indexOf(b.EDUC_GRP),
      ))])), d => d[0])
      .join((enter) =>
        enter
          .append("text")
          .attr("class", "label")
          .attr("x", d => this.xScale(d[1][d[1].length - 1].EDUC_GRP) + 10)
          .attr("y", this.innerHeight)
          .attr("dominant-baseline", "middle")
          .attr("fill", d => this.colorScale(d[0]))
          .text(d => d[0])
          .transition().duration(200)
          .attr("y", d => d.relaxed),
        (update) => {
          update.transition().duration(200)
            .attr("y", d => d.relaxed)
        })


    g.selectAll("circle")
      .data(slice)
      .join((enter) => {
        enter.append("circle")
          .attr("cx", d => this.xScale(d.EDUC_GRP))
          .attr("cy", this.innerHeight)
          .attr("r", 5)
          .attr("fill", d => this.colorScale(d.GEN))
          .attr("opacity", (d) => d.GEN === genFocus ? 1 : 0.2)
          .transition().duration(200)
          .attr("cy", d => this.yScale(+d.CUM_WT))
      }, (update) => {
        update
          .attr("opacity", (d) => d.GEN === genFocus ? 1 : 0.2)

      })

    const xAxis = d3.axisBottom(this.xScale)
    const yAxis = d3.axisLeft(this.yScale).tickFormat(d3.format(".0%"))

    g.selectAll("g.xaxis").data([0]).join("g")
      .attr("class", "xaxis")
      .attr("transform", `translate(0, ${this.innerHeight})`)
      .call(xAxis)

    const yaxis = g.selectAll("g.yaxis").data([0]).join("g")
      .attr("class", "yaxis")
      .call(yAxis)
      .lower()

    yaxis.selectAll(".tick line")
      .attr("x1", -6)
      .attr("x2", this.innerWidth)
      .attr("opacity", 0.1)

    yaxis.selectAll(".domain").remove()

    yaxis.selectAll("text.label")
      .data([0])
      .join("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("y", -48)
      .attr("x", -this.innerHeight / 2)
      // .attr("dy", ".75em")
      .attr("fill", "black")
      .attr("transform", "rotate(-90)")
      .text("Share of respondents within a generation")
  }

}
