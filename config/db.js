import { config } from "dotenv";
import pkg from 'pg'

const { Pool } = pkg

config()

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: 'localhost',
    port: 5432,
    database: process.env.DB_NAME
})

export default pool