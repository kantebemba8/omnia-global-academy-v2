import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubscribeRequest {
  prenom: string;
  email: string;
  telephone?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: SubscribeRequest = await req.json();
    const { prenom, email, telephone } = body;

    // Validate inputs
    if (!prenom || typeof prenom !== 'string' || prenom.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, message: "Le prenom est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(JSON.stringify({ success: false, message: "Format d'email invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize inputs
    const sanitizedPrenom = prenom.trim().substring(0, 255);
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 255);
    const sanitizedTelephone = telephone?.trim().substring(0, 50) || null;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if email already exists
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', sanitizedEmail)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: false, message: "Cet email est deja enregistre." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into waitlist table
    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({
        prenom: sanitizedPrenom,
        email: sanitizedEmail,
        telephone: sanitizedTelephone,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ success: false, message: "Cet email est deja enregistre." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    // Try to sync with Brevo if API key is configured
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const brevoListId = Deno.env.get('BREVO_WAITLIST_LIST_ID') || '8';

    if (brevoApiKey) {
      try {
        const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': brevoApiKey,
          },
          body: JSON.stringify({
            email: sanitizedEmail,
            attributes: {
              FIRSTNAME: sanitizedPrenom,
              SMS: sanitizedTelephone || undefined,
            },
            listIds: [parseInt(brevoListId)],
            updateEnabled: false,
          }),
        });

        if (brevoResponse.ok) {
          // Mark as synced in database
          await supabase
            .from('waitlist')
            .update({ brevo_synced: true })
            .eq('email', sanitizedEmail);
        } else {
          const brevoError = await brevoResponse.json();
          console.error('Brevo API error:', brevoError);

          // Check for duplicate contact error from Brevo
          if (brevoError.code === 'duplicate_parameter') {
            return new Response(JSON.stringify({ success: false, message: "Cet email est deja enregistre." }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (brevoError) {
        console.error('Failed to sync with Brevo:', brevoError);
        // Continue even if Brevo fails - the data is still saved locally
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error processing subscription:', error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue, reessayez." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
