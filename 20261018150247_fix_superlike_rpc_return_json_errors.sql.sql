CREATE OR REPLACE FUNCTION public.send_superlike(target_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_id uuid := auth.uid();
  author_id uuid;
  sender_balance integer;
  cost integer := 100;
  superlike_boost_value numeric := 150.0;
BEGIN
  IF sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get post author
  SELECT user_id INTO author_id FROM posts WHERE id = target_post_id;
  IF author_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;

  -- Prevent superliking your own post
  IF author_id = sender_id THEN
    RETURN json_build_object('success', false, 'error', 'You cannot SuperLike your own post');
  END IF;

  -- Atomic balance check + deduction
  UPDATE profiles
  SET wallet_balance = wallet_balance - cost
  WHERE id = sender_id
  AND wallet_balance >= cost
  RETURNING wallet_balance INTO sender_balance;

  IF sender_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient Aura Coins');
  END IF;

  -- Tip: credit 100 coins to the post author
  UPDATE profiles
  SET wallet_balance = wallet_balance + cost
  WHERE id = author_id;

  -- Update post metrics
  UPDATE posts
  SET
    superlikes_count = superlikes_count + 1,
    boost_score = boost_score + superlike_boost_value,
    last_boosted_at = now()
  WHERE id = target_post_id;

  -- Record transactions
  INSERT INTO transactions (user_id, type, amount, metadata)
  VALUES (sender_id, 'superlike_sent', -cost,
    jsonb_build_object('post_id', target_post_id, 'to_user', author_id));

  INSERT INTO transactions (user_id, type, amount, metadata)
  VALUES (author_id, 'superlike_received', cost,
    jsonb_build_object('post_id', target_post_id, 'from_user', sender_id));

  RETURN json_build_object('success', true, 'remaining_coins', sender_balance);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_superlike(uuid) TO authenticated;
