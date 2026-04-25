<template>
  <div class="canvas-wrapper">
    <div class="toolbar">
      <div
        v-for="color in colors"
        :key="color"
        class="color-swatch"
        :class="{ active: currentColor === color && currentTool === 'pen' }"
        :style="{
          background: color,
          border:
            color === '#ffffff' ? '1.5px solid rgba(255,255,255,0.25)' : 'none',
        }"
        @click="setColor(color)"
      />

      <div class="divider" />

      <span class="tool-icon">🖊</span>
      <input
        v-model="brushSize"
        type="range"
        class="size-slider"
        min="2"
        max="40"
      />
      <span class="size-label">{{ brushSize }}</span>

      <div class="divider" />

      <button
        class="tool-btn"
        :class="{ active: currentTool === 'pen' }"
        title="畫筆"
        @click="setTool('pen')"
      >
        ✏️
      </button>

      <button
        class="tool-btn"
        :class="{ active: currentTool === 'eraser' }"
        title="橡皮擦"
        @click="setTool('eraser')"
      >
        🧹
      </button>

      <button class="tool-btn" title="清除全部" @click="clearCanvas">🗑️</button>
    </div>

    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="draw-canvas"
      :style="{ cursor: currentTool === 'eraser' ? 'cell' : 'crosshair' }"
      @mousedown="startDraw"
      @mousemove="draw"
      @mouseup="stopDraw"
      @mouseleave="stopDraw"
      @touchstart.prevent="startDraw"
      @touchmove.prevent="draw"
      @touchend="stopDraw"
    />

    <p class="canvas-hint">用滑鼠或手指在畫布上繪圖 · 支援觸控裝置</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps({
  canvasWidth: { type: Number, default: 600 },
  canvasHeight: { type: Number, default: 400 },
})

const emit = defineEmits(['canvasReady'])
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let lastX = 0
let lastY = 0

const colors = [
  '#1a1a1a',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ffffff',
]

const currentColor = ref('#1a1a1a')
const brushSize = ref(6)
const currentTool = ref('pen')

const getPosition = (e: MouseEvent | TouchEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  if ('touches' in e) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY,
    }
  }

  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

const startDraw = (e: MouseEvent | TouchEvent) => {
  if (!ctx) return
  drawing = true
  const pos = getPosition(e)
  lastX = pos.x
  lastY = pos.y
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, brushSize.value / 2, 0, Math.PI * 2)
  ctx.fillStyle = currentTool.value === 'eraser' ? '#ffffff' : currentColor.value
  ctx.fill()
}

const draw = (e: MouseEvent | TouchEvent) => {
  if (!drawing || !ctx) return
  const pos = getPosition(e)
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(pos.x, pos.y)
  ctx.strokeStyle =
    currentTool.value === 'eraser' ? '#ffffff' : currentColor.value
  ctx.lineWidth = brushSize.value
  ctx.stroke()
  lastX = pos.x
  lastY = pos.y
}

const stopDraw = () => {
  drawing = false
}

const setColor = (color: string) => {
  currentColor.value = color
  setTool('pen')
}

const setTool = (tool: string) => {
  currentTool.value = tool
}

const clearCanvas = () => {
  if (!ctx) return
  ctx.clearRect(0, 0, props.canvasWidth, props.canvasHeight)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, props.canvasWidth, props.canvasHeight)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  clearCanvas()
  emit('canvasReady', canvas)
})

defineExpose({ clearCanvas, canvasRef })
</script>

<style scoped>
.canvas-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 0.6rem 1rem;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  max-width: 640px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent !important;
  transition:
    transform 0.15s,
    border-color 0.15s;
  flex-shrink: 0;
}

.color-swatch:hover {
  transform: scale(1.2);
}

.color-swatch.active {
  border-color: #fff !important;
  transform: scale(1.15);
}

.divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
}

.tool-icon {
  font-size: 0.9rem;
}

.size-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.15);
  outline: none;
  cursor: pointer;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #a78bfa;
  cursor: pointer;
}

.size-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  min-width: 20px;
  text-align: center;
}

.tool-btn {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 9px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  transition: background 0.15s;
  flex-shrink: 0;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.tool-btn.active {
  background: rgba(167, 139, 250, 0.25);
  border-color: rgba(167, 139, 250, 0.5);
  color: #a78bfa;
}

.draw-canvas {
  border-radius: 16px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  background: #ffffff;
  touch-action: none;
  max-width: 100%;
}

.canvas-hint {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.25);
  text-align: center;
}
</style>
