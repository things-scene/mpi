import { Component, Container } from "@hatiolab/things-scene";
import IMAGE from "../assets/gateway.png";
import uuidv4 from "uuid/v4";

import { buttons } from "./gateway-on-button";

import { onmessage, consoleLogger } from "./gateway-on-message";

const BUTTONS_MARGIN = 10;
const BUTTONS_GAP = 35;
const BUTTONS_RADIUS = 15;
const BUTTOMS_ICON_SIZE = 24;

const NATURE = {
  mutable: false,
  resizable: true,
  rotatable: true,
  properties: [
    {
      type: "string",
      name: "publisher",
      label: "publisher",
      placeholder: ""
    },
    {
      type: "select",
      label: "power flag",
      name: "power_flag",
      property: {
        options: [
          {
            display: "true",
            value: "true"
          },
          {
            display: "false",
            value: "false"
          }
        ]
      }
    },
    {
      type: "select",
      label: "boot flag",
      name: "boot_flag",
      property: {
        options: [
          {
            display: "true",
            value: "true"
          },
          {
            display: "false",
            value: "false"
          }
        ]
      }
    }
  ]
};

export default class Gateway extends Container {
  static get image() {
    if (!Gateway._image) {
      Gateway._image = new Image();
      Gateway._image.src = IMAGE;
    }

    return Gateway._image;
  }

  static get buttonImages() {
    if (!Gateway._buttonImages) {
      Gateway._buttonImages = [];

      buttons.forEach(button => {
        let image = new Image();
        image.src = button.icon;

        Gateway._buttonImages.push(image);
      });
    }

    return Gateway._buttonImages;
  }

  dispose() {
    this.timerOff();
    delete this.timeflow;
    delete this.ledBlinker;
    delete this.ledBarBlinker;
    super.dispose();
  }

  buttonContains(x, y) {
    var rx = BUTTONS_RADIUS;
    var ry = BUTTONS_RADIUS;

    return buttons.find((button, idx) => {
      let cx = idx * BUTTONS_GAP + BUTTONS_RADIUS / 2;
      let cy = BUTTONS_RADIUS;

      let normx = (x - cx) / (rx * 2 - 0.5);
      let normy = (y - cy) / (ry * 2 - 0.5);

      return normx * normx + normy * normy < 0.25;
    });
  }

  passIndicatorsMessage(indicatorMessage) {
    if (!this.state.power_flag || !this.state.boot_flag) return;

    this.publisher.data = {
      properties: this.generateMessageProperties(),
      body: indicatorMessage
    };
    consoleLogger(
      "sent " +
        (indicatorMessage.action
          ? indicatorMessage.action
          : "indicator message"),
      this.publisher.data
    );
  }

  generateMessageProperties() {
    return {
      id: uuidv4(),
      time: Date.now(),
      dest_id: "mps_server",
      source_id: this.model.id,
      is_reply: false
    };
  }

  generateReplyMessage(messageId, destId, action, body) {
    var msg = {
      properties: {
        id: messageId,
        time: Date.now(),
        dest_id: destId,
        source_id: this.model.id,
        is_reply: true
      },
      body: {
        action: action + "_ACK"
      }
    };
    switch (action) {
      case "IND_ON_REQ":
        msg.body = {
          action: "IND_ON_REQ_ACK",
          biz_type: body.biz_type,
          action_type: body.action_type,
          ret_args: body.ret_args,
          read_only: body.read_only,
          ind_on: body.ind_on.map(ind => {
            let indOn = {};
            indOn.id = ind.id;
            indOn.biz_id = ind.biz_id;
            if (ind.stock_taking_id)
              indOn.stock_taking_id = ind.stock_taking_id;
            return indOn;
          })
        };
        break;
      case "LED_ON_REQ":
      case "LED_OFF_REQ":
        msg.body = {
          action: action + "_ACK",
          id: body.id
        };
        break;
    }

    return msg;
  }

  _draw(context) {
    var { left, top, width, height } = this.bounds;

    context.beginPath();

    context.rect(left, top, width, height);

    this.drawFill(context);
    this.drawStroke(context);

    context.drawImage(Gateway.image, left + width - 62 - 5, top + 5, 62, 32);

    Gateway.buttonImages.forEach((image, idx) => {
      context.beginPath();

      if (buttons[idx] === this._focusedButton) {
        context.ellipse(
          BUTTONS_MARGIN + left + idx * BUTTONS_GAP + BUTTOMS_ICON_SIZE / 2,
          BUTTONS_MARGIN + top + BUTTOMS_ICON_SIZE / 2,
          BUTTONS_RADIUS,
          BUTTONS_RADIUS,
          0,
          0,
          2 * Math.PI
        );
        context.fillStyle = "lightgray";
        context.fill();
      }

      context.drawImage(
        image,
        BUTTONS_MARGIN + left + idx * BUTTONS_GAP,
        BUTTONS_MARGIN + top,
        BUTTOMS_ICON_SIZE,
        BUTTOMS_ICON_SIZE
      );
    });
  }

  get indicators() {
    var groups = this.findAll("group");
    if (groups.length == 0) return this.findAll("indicator");
    var indicators = groups.map(function(group, index) {
      var indicator = group.findFirst("indicator");
      return indicator;
    });
    return indicators;
  }

  get publisher() {
    if (this.state.publisher) {
      return this.findById(this.state.publisher);
    } else {
      return this.findFirst("mqtt");
    }
  }

  get timer() {
    return this.findFirst("seven-segment");
  }

  startBlinkingLed() {
    this.ledBlinker = setTimeout(() => {
      this.indicators.forEach((indicator, index) => {
        // 인디케이터가 켜져있고,
        var isLightOn = indicator.state.boot_flag == "true" && indicator.lit;
        // 버튼 모드가 BLINK이고,
        var isBtnModeBlink =
          indicator.getConf.btn_mode === indicator.btnModes.BLINK;
        // display 상태가 아닐 때
        var isNotDisplay = indicator.currentTask !== indicator.tasks.DISPLAY;
        // 또는 인디케이터가 FULL 상태이며 이 상태에서 깜박임 옵션이 true일 때
        var isFullState = indicator.currentTask == indicator.tasks.FULL;
        if (
          isLightOn &&
          ((isBtnModeBlink && isNotDisplay) ||
            (indicator.getConf.blink_if_full && isFullState))
        ) {
          indicator.getState("buttonColor") === "#0000"
            ? indicator.setState(
                "buttonColor",
                String(indicator.colors[indicator.store.color]) || "#0000"
              )
            : indicator.setState("buttonColor", String("#0000"));
        }
      });
      if (this.ledBlinker) this.startBlinkingLed();
    }, this.indicators[0].getConf.btn_intvl * 100);
  }

  stopBlinkingLed() {
    clearTimeout(this.ledBlinker);
  }

  startBlinkingLedBar() {
    this.ledBarBlinker = setTimeout(() => {
      this.indicators.forEach((indicator, index) => {
        if (
          indicator.ledLit &&
          indicator.getConf.led_bar_mode === indicator.btnModes.BLINK
        ) {
          if (indicator.ledRect.strokeStyle === "#0000") {
            indicator.ledRect.strokeStyle =
              "#f00" +
              Math.round((indicator.getConf.led_bar_brtns * 15) / 10).toString(
                16
              );
          } else {
            indicator.ledRect.strokeStyle = "#0000";
          }
        }
      });
      if (this.ledBarBlinker) this.startBlinkingLedBar();
    }, this.indicators[0].getConf.led_bar_intvl * 100);
  }

  stopBlinkingLedBar() {
    clearTimeout(this.ledBarBlinker);
  }

  boot() {
    if (this.state.boot_flag == "true") return;
    var { indicators, publisher } = this;

    consoleLogger("onclickStart");

    // 2.1 indicator ready
    this.indicators.forEach(indicator => {
      var segLen =
        indicator.displays.length * indicator.displays[0].pattern.length;
      // 2.2 indicater ID 점등
      if (indicator.model.id) {
        // id가 있으면 점등
        indicator.displayMessage(indicator.model.id);
      } else {
        // id가 없으면 무작위값 점등
        indicator.displayMessage(
          (
            "0".repeat(segLen - 1) +
            Math.floor(Math.random() * parseInt(1 + "0".repeat(segLen)))
          ).substr(-segLen)
        );
      }
    });

    // 2.3 gateway ready
    this.setState("power_flag", "true");

    // 2.4 boot request to M/W
    if (publisher) {
      publisher.data = {
        properties: this.generateMessageProperties(),
        body: {
          action: "GW_INIT_REQ",
          id: this.model.id //.split('/')[this.model.id.split('/').length - 1]
        }
      };
    }
    consoleLogger("sent GW_INIT_REQ", publisher.data);
  }

  off() {
    if (this.state.power_flag == "false") return;

    this.timerOff();
    this.stopBlinkingLed();
    this.stopBlinkingLedBar();

    this.setState("power_flag", String("false"));
    this.setState("boot_flag", String("false"));

    this.indicators.forEach(indicator => {
      indicator.setState("boot_flag", String("false"));
      indicator.ledRect.strokeStyle = "#0000";
      indicator.lightOff();
    });
    consoleLogger("turned off " + this.model.id);
  }

  setTimer(timestamp) {
    if (!this.timer) return;
    var digitalClock =
      ("0" + new Date(timestamp).getHours()).substr(-2) +
      ":" +
      ("0" + new Date(timestamp).getMinutes()).substr(-2) +
      ":" +
      ("0" + new Date(timestamp).getSeconds()).substr(-2);
    this.timer.value = digitalClock;
  }

  timerOn() {
    // if (this.timer) {
    //   consoleLogger(this.model.id, "timer on");
    //   let hms = this.timer.value.split(':').map(t => {
    //     return parseInt(t);
    //   });
    //   this.timeflow = setInterval(() => {
    //     if (!this.root || !this.timer) { this.timerOff(); delete this.timeflow; return; }
    //     hms[2]++;
    //     if (hms[2] >= 60) {
    //       hms[2] = 0;
    //       hms[1]++;
    //       if (hms[1] >= 60) {
    //         hms[1] = 0;
    //         hms[0]++;
    //         if (hms[0] >= 24) {
    //           hms[0] = 0;
    //         }
    //       }
    //     }
    //     this.timer.value = ("0" + hms[0]).substr(-2) + ":" + ("0" + hms[1]).substr(-2) + ":" + ("0" + hms[2]).substr(-2);
    //   }, 990);
    // }
  }

  timerOff() {
    consoleLogger(this.model.id, "timer off");

    clearInterval(this.timeflow);
  }

  onchangeData(after, before) {
    super.onchangeData(after, before);

    onmessage(this, after.data);
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

  onmousemove(e, hint) {
    var { left, top, width, height } = this.bounds;

    var { x, y } = this.transcoordC2S(e.offsetX, e.offsetY);

    var old = this._focusedButton;
    this._focusedButton = this.buttonContains(
      x - left - BUTTONS_MARGIN,
      y - top - BUTTONS_MARGIN
    );
    if (this._focusedButton !== old) {
      this.invalidate();
    }
  }

  get hasTextProperty() {
    return false;
  }

  get controls() {}

  get nature() {
    return NATURE;
  }
}

Component.register("gateway", Gateway);
