import * as d3 from 'd3';

export const initializeGlossary = () => {
  const glossItems = d3.selectAll(".definition")

  const tooltip = d3.select("body")
    .selectAll("div.glossary-tooltip")
    .data([0])
    .join("div")
    .attr("class", "glossary-tooltip")

  d3.select("body").on("click", _ => tooltip.classed("open", false))

  glossItems.on("mousemove", function(e) {
    e.stopPropagation();
    console.log(e)
    const [x, y] = d3.pointer(e, d3.select("body"))
    tooltip.classed("open", true).style("left", x + 5).style("top", y + 5).html(this.dataset.content)
    console.log(x, y)
  }).on("mouseout", function(e) {
    e.stopPropagation();
    tooltip.classed("open", false)
  })
}

export const initializeHighlight = () => {
  const highlightItems = d3.selectAll(".highlight")

  console.clear()
  highlightItems
    // .each(function (d, i, e) {console.log(this)})
    .style("background-color", function () {return this.dataset.color})
}
