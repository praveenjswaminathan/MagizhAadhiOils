
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mvwodgzvyeokiorgzhxw.supabase.co';
const supabaseKey = 'sb_publishable_y04JsS0t2URhafAttc7gYA_iFAQ6mX-';

export const supabase = createClient(supabaseUrl, supabaseKey);
