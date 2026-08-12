import type { EnvModel } from '@envm/schemas'
import { createUseList } from './useList'

export const useEnvList = createUseList<EnvModel>('env/getlist')
