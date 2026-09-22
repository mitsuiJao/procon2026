// src/broker.ts
import { Aedes } from 'aedes'
import { createServer } from 'net'

const aedes = await Aedes.createBroker()
const server = createServer(aedes.handle)

const PORT = Number(process.env.PORT ?? 1883)
server.listen(PORT, () => {
  console.log(`MQTT broker listening on port ${PORT}`)
})