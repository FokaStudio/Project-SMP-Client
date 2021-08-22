import {replaceGlobalText} from "../../../helpers/domhelper";

let handlers = {}

window.handlePeerVolumeEvent = function (e) {
    // attempt to get the handler
    let handler = handlers[e.id]
    if (handler != null) {
        handler(e)
    }
}

let total = 0;
function updateTotal() {
    replaceGlobalText("{{ oam.rtc_peer_count }}", "(" + total + ")")
}

updateTotal();

export class VoicePeerUi {

    constructor(openAudioMc, playerName, playerUuid, volume, onVolumeChange) {
        this.openAudioMc = openAudioMc;
        this.playerName = playerName;
        this.onVolumeChange = onVolumeChange;
        this.removed = false;

        let baseHtml = `
        <div class="flex items-center p-2" id="vc-user-card-` + playerName + `">
            <div class="w-12 h-12 rounded-full mr-3 overflow-hidden flex items-center text-black" id="vc-user-card-` + playerName + `-indicator">
                <img id="vc-user-card-` + playerName + `-picture" src="https://visage.surgeplay.com/bust/512/` + playerUuid + `" class="w-16">
            </div>
            <div class="flex-1">
                <div class="flex items-center">
                    <div class="font-semibold text-normal text-black"><svg id="vc-user-card-` + playerName + `-muted" class="h-8 w-8 text-red-500" style="display: none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <line x1="1" y1="1" x2="23" y2="23" /> <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /> <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /> <line x1="12" y1="19" x2="12" y2="23" /> <line x1="8" y1="23" x2="16" y2="23" /></svg>` + playerName + ` <small id="vc-user-card-` + playerName + `-volume-disp" class="text-black">(` + volume + `% volume)</small>
                    </div>
                </div>
                <div><input id="vc-user-card-` + playerName + `-volume-input" oninput="handlePeerVolumeEvent(this)"
                            class="rounded-lg overflow-hidden appearance-none bg-gray-400 h-3 w-full"
                            type="range" min="0" max="120" step="1" value="` + volume + `"/></div>
            </div>
        </div>
        `
        // insert html
        document.getElementById("vc-call-members").innerHTML += baseHtml;
        total++;
        updateTotal();

        handlers["vc-user-card-" + this.playerName + "-volume-input"] = function (e) {
            this.callingSliderUpdate(e)
        }.bind(this)

        setTimeout(() => {
            this.updatePlaceholder()
        }, 10)
    }

    callingSliderUpdate(e) {
        if (this.removed) return;
        let v = document.getElementById("vc-user-card-" + this.playerName + "-volume-input").value;
        this.onVolumeChange(v);
        this.updateVolumeDisplay(v);
    }

    updatePlaceholder() {
        if (this.openAudioMc.voiceModule.peerMap.size == 0) {
            document.getElementById("empty-call-placeholder").style.display = "";
        } else {
            document.getElementById("empty-call-placeholder").style.display = "none";
        }
    }

    remove() {
        total--;
        updateTotal();
        this.removed = true;
        document.getElementById("vc-call-members").removeChild(document.getElementById("vc-user-card-" + this.playerName))
        this.updatePlaceholder()
        delete handlers["vc-user-card-" + this.playerName + "-volume-input"]
    }

    setVisuallyTalking(state) {
        if (this.removed) return;
        if (state) {
            document.getElementById("vc-user-card-" + this.playerName + "-indicator").style.backgroundColor = "lime"
            document.getElementById("vc-user-card-" + this.playerName + "-indicator").style.boxShadow = "0 0 10pt 2pt lime"
        } else {
            document.getElementById("vc-user-card-" + this.playerName + "-indicator").style.boxShadow = ""
            document.getElementById("vc-user-card-" + this.playerName + "-indicator").style.backgroundColor = ""
        }
    }

    setVisuallyMuted(state) {
        if (this.removed) return;
        if (state) {
            document.getElementById("vc-user-card-" + this.playerName + "-picture").style.opacity = "0.2";
            document.getElementById("vc-user-card-" + this.playerName + "-muted").style.display = "inline";
        } else {
            document.getElementById("vc-user-card-" + this.playerName + "-picture").style.opacity = "1";
            document.getElementById("vc-user-card-" + this.playerName + "-muted").style.display = "none";
        }
    }

    updateVolumeDisplay(volume) {
        if (this.removed) return;
        document.getElementById("vc-user-card-" + this.playerName + "-volume-disp").innerText = "(" + volume + "% volume)";
    }

}
