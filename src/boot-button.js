import { Component, RectPath, Shape } from "@hatiolab/things-scene";
import boot from "../assets/boot-button.png";

import uuidv4 from "uuid/v4";

import { consoleLogger } from "./gateway-on-message";

export const buttons = [
  {
    icon: boot,
    handler: onclickBoot
  }
];

const BUTTONS_MARGIN = 10;
const BUTTONS_GAP = 35;
const BUTTONS_RADIUS = 15;

const NATURE = {
  mutable: false,
  resizable: true,
  rotatable: true,
  properties: [
    {
      type: "string",
      name: "publisher",
      label: "publisher"
    }
  ]
};

export default class BootButton extends RectPath(Shape) {
  static get image() {
    if (!BootButton._image) {
      BootButton._image = new Image();
      BootButton._image.src = boot;
    }

    return BootButton._image;
  }

  get publisher() {
    if (this.state.publisher) {
      return this.root.indexMap[this.state.publisher];
    }
  }

  _draw(context) {
    var { left, top, width, height } = this.bounds;

    context.beginPath();

    context.rect(left, top, width, height);

    this.drawFill(context);
    this.drawStroke(context);

    context.drawImage(BootButton.image, left, top, width, height);
  }

  onmousedown(e, hint) {
    var { left, top, width, height } = this.bounds;

    var { x, y } = this.transcoordC2S(e.offsetX, e.offsetY);

    var button = this.buttonContains(
      x - left - BUTTONS_MARGIN,
      y - top - BUTTONS_MARGIN
    );
    if (button) {
      button.handler(this);
    }
  }

  buttonContains(x, y) {
    return buttons[0];
  }

  get nature() {
    return NATURE;
  }
}

function onclickBoot(button) {
  consoleLogger("onclickBoot");
  if (!button.data) return;
  var gateways = button.data;
  for (let i = 0; i < gateways.length; i++) {
    // var gatewayObjects = gateways.map((value, index) => {
    //   return this.root.findById(value);
    // }, this);

    // gatewayObjects.forEach((gateway, index) => {
    //   gateway.boot();
    // });
    button.publisher.data = {
      properties: {
        id: uuidv4(),
        time: Date.now(),
        dest_id: "mps_server",
        source_id: gateways[i],
        is_reply: false
      },
      body: {
        action: "GW_INIT_REQ",
        id: gateways[i]
      }
    };

    consoleLogger("sent GW_INIT_REQ", button.publisher.data);
  }
}

Component.register("boot-button", BootButton);
