<template>
  <div :class="className">
    <span @click.prevent="toggle" class="icon">▶</span>
    <span class="preview js" @click.prevent="toggle" v-html="highlight('js', preview)"></span>
    <div class="rendered json" v-if="expanded" v-html="highlight('json', obj)"></div>
  </div>
</template>

<script>
export default {
  template,
  data() {
    return {
      message: "hello world",
      expanded: false
      // expanded:
      //   this.obj && JSON.stringify(this.obj, null, 2).split("\n").length <= 5,
    };
  },
  props: {
    obj: { type: Object | Array }
  },
  computed: {
    className() {
      return {
        object: true,
        expanded: this.expanded
      };
    },
    // output() {
    //   let json = JSON.stringify(this.obj, null, 2);
    //   return hljs.highlight("json", json);
    // },
    preview() {
      if (Array.isArray(this.obj)) {
        let out = [];
        for (const prop of this.obj) {
          if (Array.isArray(prop)) {
            out.push("[..]");
          } else if (typeof prop === "object" && prop !== null) {
            out.push("{..}");
          } else if (typeof prop === "string") {
            out.push('"' + prop.replace(/"/g, '\\"') + '"');
          } else {
            out.push(prop);
          }
        }
        return `[ ${out.join(", ")} ]`;
      } else {
        let out = ["{"];
        let sout = [];
        for (const key in this.obj) {
          let prop = this.obj[key];
          let o = key + ": ";
          if (Array.isArray(prop)) {
            o += "[..]";
          } else if (typeof prop === "object" && prop !== null) {
            o += "{..}";
          } else if (typeof prop === "string") {
            o += '"' + prop.replace(/"/g, '\\"') + '"';
          } else {
            o += prop;
          }
          sout.push(o);
        }
        out.push(sout.join(", "));
        out.push("}");
        return out.join(" ");
      }
    }
  },
  methods: {
    toggle() {
      this.expanded = !this.expanded;
    },
    highlight(type, text) {
      if (typeof text !== "string") text = JSON.stringify(text, null, 2);
      return hljs.highlight(type, text).value;
    }
  }
};
</script>