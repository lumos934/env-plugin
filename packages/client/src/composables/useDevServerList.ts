import type { DevServerModel } from '@envm/schemas'
import { createUseList } from './useList'

export const useDevServerList = createUseList<DevServerModel>('server/list')
