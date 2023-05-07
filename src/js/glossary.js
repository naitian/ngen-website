import * as d3 from 'd3';

export const initializeGlossary = () => {
  console.log("HEHEH")
  const glossItems = d3.selectAll(".definition")

  const tooltip = d3.select("body")
    .selectAll("div.glossary-tooltip")
    .data([0])
    .join("div")
    .attr("class", "glossary-tooltip")

  d3.select("body").on("click", _ => tooltip.classed("open", false))

  glossItems.on("click", function(e) {
    e.stopPropagation();
    console.log(e)
    const [x, y] = d3.pointer(e, d3.select("body"))
    tooltip.classed("open", true).style("left", x).style("top", y).html(this.dataset.content)
    console.log(x, y)
  })
}
