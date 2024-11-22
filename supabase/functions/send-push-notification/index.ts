import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import webPush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, body, url, subscriptions } = await req.json()

    // Configure web-push with VAPID keys
    webPush.setVapidDetails(
      'mailto:support@eventlynk.com',
      Deno.env.get('VITE_VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    // Send notifications to all subscriptions
    const notifications = subscriptions.map((subscription: PushSubscription) =>
      webPush.sendNotification(
        subscription,
        JSON.stringify({
          title,
          body,
          url,
          icon: '/logo.png',
          badge: '/logo.png'
        })
      ).catch(error => {
        console.error('Error sending notification:', error)
        return null
      })
    )

    await Promise.all(notifications)

    return new Response(
      JSON.stringify({ message: 'Notifications sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in send-push-notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})