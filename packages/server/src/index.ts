import { app } from './server.ts'
import type { Test } from '@empire-cleaning/models'

const a: Test = 'A'

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
