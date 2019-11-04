<template>
  <div :class="'log ' + log.type">
    <div>
      <span
        v-for="(segment, i) in log.processed.raw"
        :key="i"
        :class="segment.class"
        :style="segment.style"
      >
        <template v-for="(part, j) in segment.parts">
          <span :key="i + '_' + j" v-if="typeof part === 'string'" v-html="part"></span>
          <js-object :key="i + '_' + j" v-else-if="typeof part === 'object'" :obj="part" />
        </template>
      </span>
      <!-- <div v-html="log.formatted"></div> -->
    </div>
  </div>
</template>

<script>
export default {
  props: {
    log: { type: Object }
  },
  mounted() {}
};
</script>