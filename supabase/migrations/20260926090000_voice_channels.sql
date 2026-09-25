-- Voice chat signalling runs over private Realtime broadcast channels named voice:<game id>.
-- Only the two players of that game may send or receive on it.

CREATE OR REPLACE FUNCTION public.is_voice_participant(p_topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_topic LIKE 'voice:%'
     AND (SELECT public.mfa_ok())
     AND EXISTS (
       SELECT 1 FROM public.games g
       WHERE g.id::text = substr(p_topic, 7)
         AND auth.uid() IN (g.white_id, g.black_id)
     );
$$;
REVOKE EXECUTE ON FUNCTION public.is_voice_participant(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_voice_participant(text) TO authenticated;

DROP POLICY IF EXISTS voice_players_receive ON realtime.messages;
CREATE POLICY voice_players_receive ON realtime.messages FOR SELECT TO authenticated
  USING (realtime.messages.extension = 'broadcast' AND public.is_voice_participant(realtime.topic()));

DROP POLICY IF EXISTS voice_players_send ON realtime.messages;
CREATE POLICY voice_players_send ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (realtime.messages.extension = 'broadcast' AND public.is_voice_participant(realtime.topic()));
