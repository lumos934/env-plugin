import { ref, reactive, nextTick, useTemplateRef, onScopeDispose } from 'vue'
import type { FormInstance } from 'element-plus'

/** useFormDialog 的模板 ref key 类型：每个弹窗实例使用不同的 key，支持同一组件内多实例并存 */
type TemplateRefKey = 'formRef' | `formRef:${string}`

/** 编辑数据：表单字段均可选（Partial）+ 编辑模式携带的 id */
type FormEditData<T> = Partial<T> & { id?: string }

interface UseFormDialogOptions<T extends Record<string, unknown>> {
  /** 表单模板 ref 名称，用于 useTemplateRef 关联。默认为 'formRef'；
   *  同一组件内有多个弹窗时必须传入不同 key（如 'formRef:env'、'formRef:server'） */
  refKey?: TemplateRefKey
  /** 表单默认值（也用于关闭弹窗后的重置）。
   *  每次 reset 会 JSON 深拷贝一份全新对象，避免嵌套对象/数组的引用污染 */
  defaultFormData: T
  /** 提交回调，根据 mode 自行决定调用 add 还是 update API */
  onSubmit: (data: T, mode: 'add' | 'edit', id?: string) => Promise<void>
  /** 自定义表单校验函数（替代 el-form 的 rules 属性校验）。
   *  如果不传，则兜底使用 el-form 组件的 validate 方法 */
  validate?: () => Promise<boolean>
}

export function useFormDialog<T extends Record<string, unknown>>(
  options: UseFormDialogOptions<T>,
) {
  const visible = ref(false)
  const isEditMode = ref(false)
  const currentId = ref('')
  const submitting = ref(false)
  const isUnmounted = ref(false)

  // useTemplateRef 通过可配置的 key 建立模板关联
  // 同一组件的多个弹窗传入不同 refKey 即可互不干扰
  const formRef = useTemplateRef<FormInstance>(options.refKey ?? 'formRef')

  // JSON 深拷贝默认值，确保嵌套对象/数组完全隔离
  const formData = reactive<T>(JSON.parse(JSON.stringify(options.defaultFormData))) as T

  // 用于等待 el-dialog 内部表单渲染完成（比单次 nextTick 更可靠）
  let showTimer: ReturnType<typeof setTimeout> | null = null

  onScopeDispose(() => {
    isUnmounted.value = true
    if (showTimer) clearTimeout(showTimer)
  })

  // --- 内部工具 ---

  /** 等待 el-dialog 内部 v-if 渲染完成后再回调 */
  function waitFormReady(cb: () => void) {
    showTimer = setTimeout(() => {
      showTimer = null
      // 二次 nextTick：第一次等 v-if/v-show 展开，第二次等 el-form 挂载
      nextTick(() => nextTick(cb))
    }, 0)
  }

  /** 深拷贝默认值填充（每次 reset 都是全新对象） */
  function fillDefaults(merge?: Partial<T>) {
    Object.assign(formData, JSON.parse(JSON.stringify(options.defaultFormData)), merge ?? {})
  }

  /** 重置表单状态 */
  function resetData(merge?: Partial<T>) {
    fillDefaults(merge)
    isEditMode.value = false
    currentId.value = ''
  }

  // --- 公开方法 ---

  /** 打开弹窗。
   *  - editData 有值且不传 isCopy → 编辑模式
   *  - 其它情况（含 isCopy=true）→ 新增/复制模式（isCopy 时 editData 会被带上） */
  function showDialog(editData?: FormEditData<T>, isCopy = false) {
    visible.value = true

    if (editData && !isCopy) {
      isEditMode.value = true
      currentId.value = editData.id ?? ''
      fillDefaults(editData)
    } else {
      resetData(editData)
    }

    waitFormReady(() => formRef.value?.clearValidate())
  }

  /** 强制关闭弹窗并重置 */
  function closeDialog() {
    visible.value = false
    resetData()
    // 延迟清除校验，等弹窗关闭动画结束
    waitFormReady(() => formRef.value?.clearValidate())
  }

  /** 适配 el-dialog:before-close 的回调 */
  function handleClose(done: () => void) {
    resetData()
    done()
  }

  /** 提交表单 */
  async function submitForm() {
    if (submitting.value || isUnmounted.value) return

    // 1. 表单校验
    let valid = true
    if (options.validate) {
      try {
        valid = await options.validate()
      } catch {
        valid = false
      }
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          formRef.value?.validate((v) => (v ? resolve() : reject(v)))
        })
      } catch {
        valid = false
      }
    }

    if (!valid || isUnmounted.value) return

    // 2. 提交
    submitting.value = true
    try {
      const submitData = { ...formData }
      const mode = isEditMode.value && currentId.value ? 'edit' : 'add'
      await options.onSubmit(submitData, mode, currentId.value || undefined)
    } catch {
      // 错误由调用方在 onSubmit 中自行处理（如 ElMessage.error）
      // 这里不自动关闭弹窗，让用户修正后重试
    } finally {
      if (!isUnmounted.value) {
        submitting.value = false
      }
    }
  }

  return {
    visible,
    isEditMode,
    submitting,
    formData,
    showDialog,
    closeDialog,
    handleClose,
    submitForm,
  }
}
