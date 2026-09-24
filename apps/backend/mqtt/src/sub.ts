import mqtt from 'mqtt'
import { checkConnection, insertReading } from './db.js'

const client = mqtt.connect(process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883')

const topicPrefix = 'sensor/'
const subTopic = `${topicPrefix}#`


async function main() {
    await checkConnection()

    client.on('connect', () => {
        console.log('connected')
        client.subscribe(subTopic, (err) => {
            if (err) console.error('sub error:', err)
        })
    })

    client.on('message', async (topic, payload) => {
        const raw = payload.toString().trim()
        console.log(`${topic}: ${raw}`)

        const value = Number(raw)
        if (raw === '' || !Number.isFinite(value)) {
            console.warn(`invalid payload skipped: ${topic}: ${raw}`)
            return
        }

        const device = topic.slice(topicPrefix.length)

        try {
            await insertReading(device, value)
            console.log('DB write done')
        } catch (err) {
            console.error('DB write failed:', err)
        }
    })

    client.on('error', (err) => {
        console.error(err)
    })
}

main().catch((err) => {
    console.error('init error:', err)
    process.exit(1)
})