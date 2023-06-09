import scrollama from "scrollama";
import mitt from "mitt";

import { Globe } from "./globe";
import { Dots } from "./dots";
import { EducationChart } from "./education";
import { JobChart } from "./occupation";

import { initializeGlossary, initializeHighlight } from "./glossary";

window.onload = () => {
  console.log("HI")

  const emitter = mitt();
  const scroller = scrollama();

  const globe = new Globe({ emitter });
  const dots = new Dots({ emitter, circleRadius: 1.5, circlePadding: 0.5 });
  const educ = new EducationChart({ emitter });

  const occupation = new JobChart({ emitter })

  initializeGlossary()
  initializeHighlight()

  scroller
    .setup({
      step: ".step",
      offset: 0.8,
    })
    .onStepEnter(({element, index}) => {
      console.log(index)

      if (index == 1) {
        emitter.emit("select-region", {selectedRegion: "ASIA"})
      }
      if (element.dataset.step.includes("edu")) {
        emitter.emit("set-slice", +element.dataset.edu - 1)
      }
      // { element, index, direction }
    })
    .onStepExit((response) => {
      // { element, index, direction }
    });
}
