"use server";

export async function logToServer(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[SERVER LOG][${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}
