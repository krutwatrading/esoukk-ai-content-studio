import{NextRequest,NextResponse}from"next/server";

export async function GET(request:NextRequest){
 const mode=request.nextUrl.searchParams.get("hub.mode"),token=request.nextUrl.searchParams.get("hub.verify_token"),challenge=request.nextUrl.searchParams.get("hub.challenge");
 if(mode==="subscribe"&&token&&token===process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)return new NextResponse(challenge||"",{status:200});
 return NextResponse.json({error:"Webhook verification failed."},{status:403});
}

export async function POST(request:NextRequest){
 await request.json().catch(()=>null);
 return NextResponse.json({received:true});
}
