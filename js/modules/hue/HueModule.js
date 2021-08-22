import * as PluginChannel from "../../helpers/protocol/PluginChannel";
import {AlertBox} from "../ui/Notification";
import {replaceGlobalText} from "../../helpers/domhelper";

export class HueModule {

    constructor(main, hue) {
        this.hue = hue;
        this.bridges = [];
        this.isSsl = (document.location.href.startsWith("https://"));
        this.isLinked = false;
        this.currentBridge = null;
        this.currentUser = null;
        this.color = net.brehaut.Color;
        this.options = {
            "userid": Cookies.get("hueid")
        };

        this.openAudioMc = main;

        if (this.isSsl) {
            this.openAudioMc.log("Failed to initiate Philips Hue integration since this web page is served over ssl. The user will be promted to downgrade to HTTP when a user interaction is made that is related to Hue");
            return
        }

        this.hue.discover().then(bridges => {
            bridges.forEach(bridge => {
                this.bridges.push(bridge);
                this.onDiscover();
            });
        }).catch(e => console.log('Error finding bridges', e));

        document.getElementById("hue-start-linking-button").onclick = () => {
            this.startSetup();
        }
    }

    onDiscover() {
        if (this.bridges.length !== 0) {
            //bridges found
            this.openAudioMc.log(this.bridges.length + " hue bridges found");
            document.getElementById("hue-bridge-menu-button").style.display = "";
            document.getElementById("hue-setup-box").style.display = "";
            document.getElementById("hue-bridge-menu-button").onclick = this.openModal
            ;

            if (this.isSsl) {
                document.getElementById("hue-bridge-menu-button").style.display = "none";
                return;
            }

            if (this.options.userid != null) {
                this.openAudioMc.getHueModule().startSetup();
            }
        } else {
            this.openAudioMc.log("No hue bridges found");
        }
    }

    openModal() {
        document.getElementById("hue-modal-parent").style.display = '';
    }

    startSetup() {
        const that = this;
        // switch display
        document.getElementById("hue-link-menu").style.display = "none";
        document.getElementById("hue-linking-menu").style.display = "";
        this.bridges.forEach(bridge => {
            that.linkBridge(bridge.internalipaddress);
        })
    }

    onConnect() {
        this.currentUser.getConfig().then(data => {
            document.getElementById("hue-settings-menu").style.display = "";
            document.getElementById("hue-linking-menu").style.display = "none";
            document.getElementById("hue-link-menu").style.display = "none";

            this.openAudioMc.getHueConfiguration().setBridgeName(data.name);

            this.currentUser.getLights().then(data => {
                let settingsLights = [];
                for (let property in data) {
                    if (data.hasOwnProperty(property)) {
                        settingsLights.push({
                            "name": data[property].name,
                            "id": parseInt(property)
                        });
                    }
                }
                this.openAudioMc.getHueConfiguration().setLightNamesAndIds(settingsLights);
                // load state, or default
                const oldState = Cookies.get("hue-state");
                if (oldState != null) {
                    this.openAudioMc.getHueConfiguration().state = JSON.parse(Cookies.get("hue-state"));
                }

                this.openAudioMc.getHueConfiguration().applyState();
                this.openAudioMc.getHueConfiguration().updateState();
            });

            // let the server know that I am, in fact, connected
            this.openAudioMc.socketModule.send(PluginChannel.HUE_CONNECTED, {});
        });
    }

    updateSelector(name) {
        setTimeout(function () {
            document.getElementById("default-group").selected = false;
            document.getElementById("input-bridge-select").value = name;
        }, 200);
    }

    colorToHueHsv(color) {
        const jqc = this.color(color).toHSV();
        return {
            "on": (((jqc.alpha * 2) * 127.5) !== 0),
            "hue": Math.floor(65535 * jqc.hue / 360),
            "sat": Math.floor(jqc.saturation * 255),
            "bri": Math.round((jqc.alpha * 2) * 127.5)
        }
    }

    setLight(id, rgb) {
        let query = [];
        if (typeof  id == "number") {
            let lId = this.openAudioMc.getHueConfiguration().getBulbStateById((id-1));
            if (lId === -1) return false;
            query.push(lId);
        } else if (id.startsWith("[")) {
            JSON.parse(id).forEach(target => {
                let lId = this.openAudioMc.getHueConfiguration().getHueIdFromId((target-1));
                if (lId === -1) return false;
                query.push(lId);
            });
        } else {
            let lId = this.openAudioMc.getHueConfiguration().getHueIdFromId((parseInt(id)-1));
            if (lId === -1) return false;
            query.push(lId);
        }
        query.forEach(light => {
            this.currentUser.setLightState(light, this.colorToHueHsv(rgb)).then(() => {});
        });
    }

    linkBridge(bridgeIp, precheck) {
        replaceGlobalText("{{ hue.linkingUpdate }}", window.getMessageString("hue.preparing"))

        if (precheck == null && this.options.userid != null) {

            replaceGlobalText("{{ hue.linkingUpdate }}", window.getMessageString("hue.loggingIn"))

            this.currentUser = this.hue.bridge(bridgeIp).user(this.options.userid);
            this.currentUser.getGroups().then(data => {
                //check result
                if (data[0] != null && data[0].error == null) {
                    this.linkBridge(bridgeIp, "error");
                } else {
                    this.openAudioMc.log("Linked with hue bridge after trying to connect with the old username");
                    this.isLinked = true;
                    this.onConnect();
                }
            });
            //check the user
            return;
        }

        this.currentBridge = this.hue.bridge(bridgeIp);
        if (this.currentBridge == null) {
            this.openAudioMc.log("Invalid bridge IP");
            return;
        }

        const that = this;
        let linkAttempts = 0;
        let linkTask = -1;

        linkTask = setInterval(() => {
            function cancel() {
                clearInterval(linkTask);
            }

            linkAttempts++;
            if (linkAttempts > 60) {
                cancel();
                this.startSetup();
                this.openAudioMc.log("Failed to authenticate with bridge in 60 seconds.");
                return;
            }

            let sec = (60 - linkAttempts);

            // update message with time
            replaceGlobalText("{{ hue.linkingUpdate }}", window.getMessageString("hue.linking"), [["%sec", sec]])

            that.currentBridge.createUser("OpenAudioMc#WebClient")
                .then(data => {
                    if (data[0].error != null) {
                        if (data[0].error.type === 101) {
                            //link button not pressed
                        } else {
                            //unexpected error
                            cancel();
                            this.openAudioMc.log("Unexpected error while connecting: " + data[0].error.type);
                        }
                    } else if (data[0].success != null) {
                        that.currentUser = that.currentBridge.user(data[0].success.username);
                        this.openAudioMc.log("Linked with hue bridge after " + linkAttempts + " attempt(s).");
                        that.isLinked = true;
                        that.onConnect();
                        cancel();
                    }
                });
        }, 1000);
    }

}
