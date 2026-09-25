import mqtt from 'mqtt'
import { checkConnection, insertReading } from './db.js'

const client = mqtt.connect(process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883')

// topic: sensor/{device}/{metric}
const subTopic = 'sensor/+/+'
const metrics = ['temp', 'humidity', 'rainfall'] as const
type Metric = (typeof metrics)[number]

function parseTopic(topic: string): { device: string; metric: Metric } | null {
    const [prefix, device, metric, ...rest] = topic.split('/')
    if (prefix !== 'sensor' || !device || rest.length > 0) return null
    if (!metrics.includes(metric as Metric)) return null
    return { device, metric: metric as Metric }
}

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

        const parsed = parseTopic(topic)
        if (!parsed) {
            console.warn(`unknown topic skipped: ${topic}`)
            return
        }

        try {
            await insertReading(parsed.device, parsed.metric, value)
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