import { FeedbackPayload } from './types';

export interface SendFeedbackResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Dispatches the FeedbackPayload to Google Apps Script Web App
 */
export async function sendFeedbackToGas(
  endpointUrl: string,
  payload: FeedbackPayload
): Promise<SendFeedbackResult> {
  if (!endpointUrl || !endpointUrl.startsWith('https://')) {
    return {
      success: false,
      error: 'Invalid Google Apps Script Web App URL provided.',
    };
  }

  const payloadString = JSON.stringify(payload);

  try {
    // 1. Primary Attempt: Standard POST with CORS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      try {
        const json = await response.json();
        if (json.status === 'error') {
          return {
            success: false,
            error: json.message || 'Apps Script returned an error response.',
          };
        }
      } catch {
        // If response is not JSON (e.g. redirect text), still treat as success
      }
      return { success: true, message: 'Feedback sent successfully!' };
    }

    // 2. Fallback Attempt: mode 'no-cors' if primary returned opaque or error
    return await fallbackNoCorsPost(endpointUrl, payloadString);
  } catch (err: unknown) {
    // Fallback if CORS or network error occurred
    return await fallbackNoCorsPost(endpointUrl, payloadString);
  }
}

async function fallbackNoCorsPost(
  url: string,
  payloadString: string
): Promise<SendFeedbackResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // With no-cors, we can't inspect the body, but the browser dispatched the POST request
    return { success: true, message: 'Feedback dispatched successfully!' };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to dispatch feedback: ${errorMessage}`,
    };
  }
}
