import scrollama from "scrollama";
import mitt from "mitt";

import { Globe } from "./globe";
import { Dots } from "./dots";
import { EducationChart } from "./education";


window.onload = () => {
  console.log("HI")

  const emitter = mitt();
  const scroller = scrollama();

  const globe = new Globe({ emitter });
  const dots = new Dots({ emitter });
  const educ = new EducationChart({ emitter });

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
        emitter.emit("set-slice", index - 3)
      }
      // { element, index, direction }
    })
    .onStepExit((response) => {
      // { element, index, direction }
    });
}
