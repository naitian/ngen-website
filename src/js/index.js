import scrollama from "scrollama";
import mitt from "mitt";

import { Globe } from "./globe";
import { Dots } from "./dots";


window.onload = () => {
  console.log("HI")

  const emitter = mitt();
  const scroller = scrollama();

  const globe = new Globe({ emitter });
  const dots = new Dots({ emitter });

  scroller
    .setup({
      step: ".step",
      offset: 0.8,
    })
    .onStepEnter(({index}) => {
      console.log(index)

      if (index == 1) {
        emitter.emit("select-region", {selectedRegion: "ASIA"})
      }
      // { element, index, direction }
    })
    .onStepExit((response) => {
      // { element, index, direction }
    });
}
