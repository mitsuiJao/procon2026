// src/broker.ts
import { Aedes } from 'aedes'
import { createServer } from 'net'
import { timingSafeEqual } from 'crypto'

const aedes = await Aedes.createBroker()

const MQTT_USER = process.env.MQTT_USER
const MQTT_PASSWORD = process.env.MQTT_PASSWORD

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

if (MQTT_USER && MQTT_PASSWORD) {
  aedes.authenticate = (_client, username, password, callback) => {
    const ok =
      username !== undefined &&
      password !== undefined &&
      safeEqual(Buffer.from(username), Buffer.from(MQTT_USER)) &&
      safeEqual(Buffer.from(password), Buffer.from(MQTT_PASSWORD))
    if (ok) return callback(null, true)
    callback(Object.assign(new Error('Auth failed'), { returnCode: 4 }), false)
  }
} else {
  console.warn('MQTT_USER / MQTT_PASSWORD not set: running without authentication')
}

const server = createServer(aedes.handle)

const PORT = Number(process.env.PORT ?? 1883)
server.listen(PORT, () => {
  console.log(`MQTT broker listening on port ${PORT}`)
})
