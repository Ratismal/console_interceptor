<template>
  <main id="app" :class="theme">
    <div class="content">
      <h1>Console Interceptor</h1>
      <div class="button-toolbar">
        <button
          class="button"
          v-for="t of themes"
          :key="t"
          @click.prevent="selectTheme(t)"
        >{{t}} Theme</button>
      </div>
      <p>Open content inspector to view logs from all active sessions.</p>
      <p>
        To send a message to all sessions, type
        <code>send("code to evaluate here");</code>.
      </p>
      <h2>File Upload</h2>Use this to send files from your phone to this computer:
      <input
        type="file"
        @change="previewFile"
        multiple
      />
      <span>{{fileNotice}}</span>
    </div>
    <div class="sticky">
      <div class="content">
        <h2>Active Sessions</h2>
        <label>Filter:</label>
        <input id="filter" v-model="filter" />
      </div>
    </div>
    <transition-group class="site-wrapper" id="sessions" name="session" tag="div">
      <div v-for="site of receiver.sites" :key="site.id" :id="site.hip" :class="getClass(site.id)">
        <div class="title">
          <span class="href">
            {{site.origin}}
            <span class="closed" v-if="site.closed">- SESSION CLOSED</span>
          </span>
          <span class="id">{{site.hip}}</span>
          <div class="button-group">
            <button class="button" @click.prevent="toggleSite(site.id)">Collapse</button>
            <button class="button danger" @click.prevent="clearSite(site)">Clear</button>
            <button class="button danger" @click.prevent="removeSite(site)">Remove</button>
          </div>
        </div>
        <div class="logs-wrapper">
          <div class="logs">
            <log v-for="log of getLogs(site)" :key="log.id" :log="log" />
          </div>
          <div class="log-input-wrapper">
            <div class="log-input">
              <input
                type="text"
                v-model="mods[site.id].input"
                @keydown.up.exact.prevent="moveHistory(1, site.id)"
                @keydown.down.exact.prevent="moveHistory(-1, site.id)"
                @keydown.enter.exact.prevent="confirmInput(site)"
              />
            </div>
          </div>
        </div>
      </div>
    </transition-group>
  </main>
</template>

<script>
export default {
  data() {
    let history = localStorage.getItem("history");
    history = history ? JSON.parse(history) : (history = []);
    return {
      receiver: window.receiver,
      filter: "",
      inputs: {},
      mods: {},
      theme: localStorage.getItem("theme") || "light",
      themes: ["Light", "Dark"],
      history,
      file: null,
      fileNotice: ""
    };
  },
  watch: {
    theme(newValue) {
      localStorage.setItem("theme", newValue);
    },
    history(newValue) {
      localStorage.setItem("history", JSON.stringify(newValue));
    },
    filter() {
      let els = this.$el.querySelectorAll(".logs");
      setTimeout(function() {
        for (const el of els) {
          el.scrollTop += el.scrollHeight;
        }
      }, 1);
    }
  },
  methods: {
    async previewFile(e) {
      const file = e.target.files[0];
      if (e.target.files.length > 0) {
        let formData = new FormData();
        for (const file of e.target.files) {
          formData.append("file", file);
        }
        await fetch("/upload", { method: "POST", body: formData });
        this.fileNotice = "File has been uploaded!";
        setTimeout(() => {
          this.fileNotice = "";
          e.target.value = "";
        }, 2000);
      }
    },
    selectTheme(theme) {
      this.theme = theme.toLowerCase();
    },
    initMod(id) {
      if (!this.mods[id])
        Vue.set(this.mods, id, {
          collapsed: false,
          index: -1,
          cachedInput: "",
          input: "",
          hasCollapsed: false
        });
    },
    getClass(id) {
      this.initMod(id);
      let site = this.receiver.sites.find(s => s.id === id);
      if (site.closed && !this.mods[id].hasCollapsed) {
        this.mods[id].hasCollapsed = true;
        this.mods[id].collapsed = true;
      }
      return {
        session: true,
        collapsed: !!this.mods[id].collapsed,
        closed: !site || site.closed
      };
    },
    toggleSite(id) {
      this.mods[id].collapsed = !this.mods[id].collapsed;
    },
    formatLog(log) {
      return this.receiver.formatLog(log);
    },
    getLogs(site) {
      let f = this.filter
        .toLowerCase()
        .trim()
        .split(/\s/);
      return site.logs.filter(l =>
        f.every(
          _f =>
            l.processed.minified !== null &&
            l.processed.minified.some(m => m.includes(_f))
        )
      );
    },
    confirmInput(site) {
      let input = this.mods[site.id].input;
      // add entry to beginning of history
      this.history = this.history.filter(h => h !== input);
      this.history.unshift(input);
      if (input) {
        this.receiver.addLog(site, {
          type: "eval_input",
          args: [input],
          id: Date.now()
        });
        this.receiver.socket.send(
          JSON.stringify({
            code: "eval",
            target: site.id,
            content: input
          })
        );
        this.mods[site.id].input = "";
        this.mods[site.id].index = -1;
      }
    },
    clearSite(site) {
      site.logs = [];
    },
    removeSite(site) {
      let sites = this.receiver.sites;
      sites.splice(sites.indexOf(site), 1);
    },
    moveHistory(amount, id) {
      let site = this.mods[id];
      if (site.index === -1 && amount === 1) {
        site.cachedInput = site.input;
      }
      site.index = Math.min(
        Math.max(site.index + amount, -1),
        this.history.length - 1
      );
      console.log(site.index, this.history);
      if (site.index === -1) {
        site.input = site.cachedInput;
      } else {
        site.input = this.history[site.index];
      }
    }
  }
};
</script>
