<template>
  <div :class="className">
    <span @click.prevent="toggle" class="icon">▶</span>
    <span class="preview" @click.prevent="toggle">{{preview}}</span>
    <div class="rendered" v-if="expanded">{{obj}}</div>
  </div>
</template>

<script>
export default {
  template,
  data() {
    console.log(this.obj);
    return {
      message: "hello world",
      expanded: false
      // expanded:
      //   this.obj && JSON.stringify(this.obj, null, 2).split("\n").length <= 5
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
    preview() {
      if (Array.isArray(this.obj)) {
        let out = [];
        for (const prop of this.obj) {
          if (Array.isArray(prop)) {
            out.push("[..]");
          } else if (typeof prop === "object" && prop !== null) {
            out.push("{..}");
          } else {
            out.push(prop);
          }
        }
        return `[ ${out.join(", ")} ]`;
      } else {
        let out = ["{"];
        for (const key in this.obj) {
          let prop = this.obj[key];
          out.push(key + ":");
          if (Array.isArray(prop)) {
            out.push("[..]");
          } else if (typeof prop === "object" && prop !== null) {
            out.push("{..}");
          } else {
            out.push(prop);
          }
        }
        out.push("}");
        return out.join(" ");
      }
    }
  },
  methods: {
    toggle() {
      this.expanded = !this.expanded;
    }
  }
};
</script>