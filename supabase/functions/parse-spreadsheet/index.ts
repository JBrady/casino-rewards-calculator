// supabase/functions/parse-spreadsheet/index.ts

import { serve } from "std/http/server"; // Use alias from import map
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "@supabase/supabase-js"; // Use alias from import map
import * as xlsx from "xlsx"; // Use alias from import map

interface WagerRecord {
  user_id: string;
  wager_date: string | null; // Store as ISO string or YYYY-MM-DD
  casino_name: string | null;
  game_played: string | null;
  bet_size: number | null;
  num_plays: number | null;
  ending_balance: number | null;
  total_wagered: number | null;
  total_won: number | null;
  net_result: number | null;
  rtp: number | null;
}

interface TransactionRecord {
  user_id: string;
  transaction_date: string | null; // Store as ISO string or YYYY-MM-DD
  casino_name: string | null;
  type: string | null;
  amount_spent: number | null;
  redemption_request: number | null;
  after_playthrough_value: number | null;
  cc_points: number | null;
  tax_implications: number | null;
}

// Helper to safely convert Excel value to number
function safeToNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// Helper to safely convert Excel value to string
function safeToString(value: any): string | null {
    if (value === null || value === undefined) return null;
    return String(value).trim() || null; // Return null if empty string after trim
}

// Helper to convert Excel date serial number to YYYY-MM-DD string
// SheetJS provides utilities or we handle manually if needed
function excelSerialDateToYYYYMMDD(serial: number | string | null): string | null {
    if (typeof serial !== 'number') return null;
    if (serial <= 0) return null;
    // Excel serial date starts from 1 representing 1900-01-01
    // JavaScript Date counts milliseconds from 1970-01-01 UTC
    // Need to account for Excel's leap year bug (treating 1900 as leap year)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel day 0 is 1899-12-30
    const jsDate = new Date(excelEpoch.getTime() + serial * 86400000); // 86400000 ms in a day

    if (isNaN(jsDate.getTime())) return null; // Invalid date calculation

    // Format to YYYY-MM-DD (UTC to avoid timezone issues with just date)
    const year = jsDate.getUTCFullYear();
    const month = (jsDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = jsDate.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

console.log('Function loaded. Setting up serve...');

serve(async (req: Request) => {
  console.log('Received request:', { method: req.method, url: req.url, headers: Object.fromEntries(req.headers) });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Log request body type (be careful logging full body with large files)
  console.log('Request content-type:', req.headers.get('content-type'));

  try {
    // 1. Authentication & User ID
    // Functions are invoked with the user's session automatically handled by Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        console.error('Missing Authorization header');
        throw new Error('Missing Authorization header');
    }
    console.log('Authorization header present.');

    // Create a Supabase client with the user's JWT to verify and get user ID
    // NOTE: This client is ONLY for getting the user ID securely from the JWT.
    // Database operations MUST use the admin client later.
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        console.error('Error getting user or no user found:', userError);
        throw new Error(userError?.message || 'User not found or invalid token');
    }
    const userId = user.id;
    console.log(`Authenticated user ID: ${userId}`);

    // 2. Read File from FormData
    console.log('Attempting to read FormData...');
    const formData = await req.formData();
    const file = formData.get('spreadsheet') as File | null;

    if (!file) {
        console.error('Could not find \'spreadsheet\' field in FormData');
        throw new Error('Spreadsheet file not found in request data.');
    }
    console.log(`Received file from FormData: ${file.name}, Size: ${file.size}`);

    console.log('Reading file content into buffer...');
    const buffer = await file.arrayBuffer();
    console.log(`Read buffer of size: ${buffer.byteLength}`);

    if (buffer.byteLength === 0) {
        console.error('Received empty file');
        throw new Error('Received empty file');
    }

    console.log('Parsing workbook...');
    const workbook = xlsx.read(new Uint8Array(buffer), { type: 'array' });
    console.log('Workbook parsed. Sheets:', workbook.SheetNames);

    // Check for required sheets
    if (!workbook.SheetNames.includes('Wagers') || !workbook.SheetNames.includes('Transactions')) {
        console.error('Missing required sheets: Wagers or Transactions');
        throw new Error('Spreadsheet must contain both \'Wagers\' and \'Transactions\' sheets.');
    }
    console.log('Required sheets found.');

    // Parse 'Wagers' sheet
    const wagersSheetName = 'Wagers'; // Adjust if sheet name is different
    const wagersSheet = workbook.Sheets[wagersSheetName];
    if (!wagersSheet) {
      return new Response(JSON.stringify({ error: `Sheet '${wagersSheetName}' not found in the spreadsheet.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const wagersData: any[] = xlsx.utils.sheet_to_json(wagersSheet);
    console.log('[DEBUG] Raw Wagers Data Parsed:', JSON.stringify(wagersData, null, 2));
    const parsedWagers: WagerRecord[] = [];

    console.log(`Found ${wagersData.length} rows in ${wagersSheetName}`);

    for (const row of wagersData) {
        // Assuming column order based on ChatGPT description:
        // Date[0], Casino Name[1], Game Played[2], Bet Size[3], Num Plays[4],
        // Ending Balance[5], Total Wagered[6], Total Won[7], Net Result[8], RTP[9]
        if (!row || row.length === 0 || row.every(cell => cell === null || cell === '')) continue; // Skip empty rows

        // Basic check: Ensure at least a date and casino name exist?
        if (!row[0] || !row[1]) {
            console.warn("Skipping wager row due to missing Date or Casino Name:", row);
            continue;
        }

        const wager: WagerRecord = {
            user_id: userId,
            // IMPORTANT: xlsx library with cellDates:true might return JS Date objects.
            // If it returns serial numbers, use excelSerialDateToYYYYMMDD. Check output.
            // If it returns JS Date, format it.
            wager_date: row[0] instanceof Date ? row[0].toISOString().split('T')[0] : excelSerialDateToYYYYMMDD(row[0]),
            casino_name: safeToString(row[1]),
            game_played: safeToString(row[2]),
            bet_size: safeToNumber(row[3]),
            num_plays: safeToNumber(row[4]),
            ending_balance: safeToNumber(row[5]),
            total_wagered: safeToNumber(row[6]),
            total_won: safeToNumber(row[7]),
            net_result: safeToNumber(row[8]),
            rtp: safeToNumber(row[9]),
        };

        // Additional validation if needed (e.g., check if numeric fields parsed correctly)
        parsedWagers.push(wager);
    }
    console.log(`Successfully parsed ${parsedWagers.length} wager records.`);

    // Parse 'Transactions' sheet
    const transactionsSheetName = 'Transactions'; // Adjust if sheet name is different
    const transactionsSheet = workbook.Sheets[transactionsSheetName];
    if (!transactionsSheet) {
      return new Response(JSON.stringify({ error: `Sheet '${transactionsSheetName}' not found in the spreadsheet.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const transactionsData: any[] = xlsx.utils.sheet_to_json(transactionsSheet);
    console.log('[DEBUG] Raw Transactions Data Parsed:', JSON.stringify(transactionsData, null, 2));
    const parsedTransactions: TransactionRecord[] = [];

    console.log(`Found ${transactionsData.length} rows in ${transactionsSheetName}`);

    for (const row of transactionsData) {
        // Assuming column order:
        // Date[0], Casino Name[1], Type[2], Amount Spent[3], Redemption Request[4],
        // After Playthrough Value[5], Credit Card Points[6], Tax Implications[7]
        if (!row || row.length === 0 || row.every(cell => cell === null || cell === '')) continue;

        // Basic check
        if (!row[0] || !row[1]) {
            console.warn("Skipping transaction row due to missing Date or Casino Name:", row);
            continue;
        }

        const transaction: TransactionRecord = {
            user_id: userId,
            transaction_date: row[0] instanceof Date ? row[0].toISOString().split('T')[0] : excelSerialDateToYYYYMMDD(row[0]),
            casino_name: safeToString(row[1]),
            type: safeToString(row[2]),
            amount_spent: safeToNumber(row[3]),
            redemption_request: safeToNumber(row[4]),
            after_playthrough_value: safeToNumber(row[5]),
            cc_points: safeToNumber(row[6]),
            tax_implications: safeToNumber(row[7]),
        };
        parsedTransactions.push(transaction);
    }
    console.log(`Successfully parsed ${parsedTransactions.length} transaction records.`);

    // 4. Database Operations (Use Admin Client to bypass RLS)
    // IMPORTANT: Use the Service Role Key for admin actions
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SERVICE_ROLE_KEY') ?? '' // Use Service Role Key!
    );

    // Delete existing data for the user (wrap in transaction if possible/needed)
    // Note: Supabase JS v2 doesn't have explicit transaction support easily usable here.
    // We rely on sequential execution. If one delete fails, insert might still happen.
    // Consider more robust handling for production (e.g., stored procedures).

    console.log(`Deleting existing data for user ${userId}...`);
    const { error: deleteWagersError } = await supabaseAdmin
        .from('user_wagers')
        .delete()
        .eq('user_id', userId);

    if (deleteWagersError) throw deleteWagersError;
    console.log("Existing wagers deleted.");

    const { error: deleteTransactionsError } = await supabaseAdmin
        .from('user_transactions')
        .delete()
        .eq('user_id', userId);

    if (deleteTransactionsError) throw deleteTransactionsError;
    console.log("Existing transactions deleted.");

    // Insert new data
    console.log(`Inserting ${parsedWagers.length} wagers and ${parsedTransactions.length} transactions...`);
    if (parsedWagers.length > 0) {
        const { error: insertWagersError } = await supabaseAdmin
            .from('user_wagers')
            .insert(parsedWagers);
        if (insertWagersError) throw insertWagersError;
        console.log("New wagers inserted.");
    }

    if (parsedTransactions.length > 0) {
        const { error: insertTransactionsError } = await supabaseAdmin
            .from('user_transactions')
            .insert(parsedTransactions);
        if (insertTransactionsError) throw insertTransactionsError;
        console.log("New transactions inserted.");
    }

    // 5. Send Success Response
    return new Response(JSON.stringify({
        message: `Successfully processed spreadsheet. Added ${parsedWagers.length} wager records and ${parsedTransactions.length} transaction records.`,
        wagersAdded: parsedWagers.length,
        transactionsAdded: parsedTransactions.length,
     }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing spreadsheet:', error);
    // Ensure CORS headers are included in error responses too
    return new Response(JSON.stringify({ message: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof Error && (error.message.includes('sheet') || error.message.includes('Missing Authorization') || error.message.includes('User not found') || error.message.includes('empty file') || error.message.includes('not found in request data')) ? 400 : 500, // Use 400 for specific client errors
    });
  }
});

console.log('Function setup complete. Waiting for requests...');