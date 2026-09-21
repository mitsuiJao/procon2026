import mqtt from 'mqtt'

const client = mqtt.connect('mqtt://localhost:1883')

const subTopic = 'sensor/#'

client.on('connect', () => {
    console.log('connected')
    client.subscribe(subTopic, (err) => {
        if (err) console.error('sub error:', err)
    })
})

client.on('message', (topic, payload) => {
    console.log(`${topic}: ${payload.toString()}`)
})

client.on('error', (err) => {
    console.error(err)
})