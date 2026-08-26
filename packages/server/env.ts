import {env as loadEnv} from 'custom-env'
import {z} from 'zod'

process.env.APP_STAGE = process.env.APP_STAGE || 'dev'
