import {Channel} from "./Channel";
import {Sound} from "./Sound";
import {DebugPanel, WhenDebugging} from "../../../debug";
import {OpenAudioEnv} from "../../../OpenAudioMc";
import {prefetchedSounds} from "../../../helpers/utils/AudioFactory";

export class Mixer {

    constructor(mixerName, main) {
        this.openAudioMc = main;
        this.mixerName = mixerName;
        this.masterVolume = 100;
        this.channels = new Map();
        this.areSoundsPlaying = false;
        this.ambianceSoundMedia = null;
        this.recentSource = "/none";

        // update debug
        WhenDebugging(() => {
            window.debugUi.addPanel(DebugPanel.AUDIO, () => "playingChannels=" + this.channels.size + ", prefetched=" + Object.keys(prefetchedSounds).length +
             ", recent=" + this.recentSource.split("/")[this.recentSource.split("/").length - 1])
        })
    }

    _updatePlayingSounds() {
        let foundPlayingSound = false;
        this.channels.forEach((channel, key) => {
            if (channel.hasSoundPlaying()) {
                foundPlayingSound = true;
            }
        });
        if (foundPlayingSound != this.areSoundsPlaying) {
            this._playingStateChangeChanged(foundPlayingSound);
            this.areSoundsPlaying = foundPlayingSound;
        }
    }

    _playingStateChangeChanged(isSoundPlaying) {
        if (this.ambianceSoundMedia == null) return;
        if (!isSoundPlaying) {
            // start
            console.log("Starting ambiance sound")
            this.ambianceSoundMedia.fadeChannel(this.masterVolume, 800, () => {});
        } else {
            // stop
            console.log("Stopping ambiance sound")
            this.ambianceSoundMedia.fadeChannel(0, 800, () => {});
        }
    }

    async setupAmbianceSound(source) {
        // create media
        let channel = new Channel("ambiance-lol-dics");
        let ambianceMedia = new Sound();
        ambianceMedia.setOa(this.openAudioMc)
        channel.mixer = openAudioMc.getMediaManager().mixer;
        await ambianceMedia.load(source)
        channel.addSound(ambianceMedia);
        ambianceMedia.setLooping(true);
        ambianceMedia.setVolume(0);
        ambianceMedia.finalize().then(() => {
            ambianceMedia.finish();
        });
        channel.mixer = {masterVolume: this.masterVolume};
        this.ambianceSoundMedia = channel;
        this.ambianceSoundMedia.mixer = {masterVolume: this.masterVolume};
        this.ambianceSoundMedia.setChannelVolume(0);
        this.ambianceSoundMedia.updateFromMasterVolume(this.masterVolume);
        this._updatePlayingSounds();
    }

    updateCurrent() {
        let current = [];
        this.channels.forEach((channel, key) => {
            let tags = [];
            channel.tags.forEach((value, tag) => {
                tags.push(tag);
            });

            if (channel.trackable) {
                current.push({
                    "name": key,
                    "tags": tags
                });
            }
        });


        // TODO: fix
        // TODO: Actually do this some day, has been on TODO for al ong while now, idiot
        // TODO: https://github.com/users/Mindgamesnl/projects/1#card-42495990
        // this.openAudioMc.socketModule.send(PluginChannel.CHANNELS_UPDATED, {
        //     "tracks": current
        // });
        this._updatePlayingSounds();
    }

    setMasterVolume(masterVolume) {
        this.masterVolume = masterVolume;
        for (let channel of this.channels.values()) {
            channel.updateFromMasterVolume();
        }

        if (this.ambianceSoundMedia != null) {
            this.ambianceSoundMedia.mixer = {masterVolume: this.masterVolume};
            this.ambianceSoundMedia.updateFromMasterVolume(masterVolume);
        }
    }

    removeChannel(channelName) {
        let channel;
        if (channelName instanceof Channel) {
            channel = channelName;
        } else {
            channel = this.channels.get(channelName);
        }

        if (channel != null) {
            channel.destroy();
            this.channels.delete(channel.channelName);
        }
        this._updatePlayingSounds();
    }

    getChannels() {
        return this.channels.values();
    }

    addChannel(channel) {
        if (channel instanceof Channel) {
            const channelId = channel.channelName;
            const existingChannel = this.channels.get(channelId);
            if (existingChannel != null) {
                existingChannel.destroy();
            }
            channel.registerMixer(this);
            this.channels.set(channelId, channel);

            // wait for it to fetch before updating debug data
            setTimeout(() => {
                for (let x in channel.sounds) {
                    this.recentSource = channel.sounds[x].rawSource;
                }
            }, 1000);
        } else {
            throw new Error("Argument isn't a channel");
        }
        this._updatePlayingSounds();
    }

}
