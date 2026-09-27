import mqtt from 'mqtt'
import { checkConnection, insertReading } from './db.js'

const client = mqtt.connect(process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883')

// topic: sensor/{device}/data, payload: {"temp":25.3,"humidity":82.1,...}
const subTopic = 'sensor/+/data'
const metrics = ['temp', 'humidity', 'rainfall'] as const
type Metric = (typeof metrics)[number]

function parseTopic(topic: string): { device: string } | null {
    const [prefix, device, suffix, ...rest] = topic.split('/')
    if (prefix !== 'sensor' || !device || suffix !== 'data' || rest.length > 0) return null
    return { device }
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

        const parsed = parseTopic(topic)
        if (!parsed) {
            console.warn(`unknown topic skipped: ${topic}`)
            return
        }

        let json: Record<string, unknown>
        try {
            json = JSON.parse(raw)
        } catch {
            console.warn(`invalid payload skipped: ${topic}: ${raw}`)
            return
        }

        for (const metric of metrics) {
            if (!(metric in json)) continue

            const value = Number(json[metric])
            if (!Number.isFinite(value)) {
                console.warn(`invalid value skipped: ${topic}: ${metric}=${json[metric]}`)
                continue
            }

            try {
                await insertReading(parsed.device, metric, value)
                console.log(`DB write done: ${metric}`)
            } catch (err) {
                console.error('DB write failed:', err)
            }
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