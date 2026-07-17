import {NextRequest,NextResponse} from "next/server"; import {generateCampaign} from "@/lib/campaign";
export async function POST(req:NextRequest){try{return NextResponse.json({campaign:await generateCampaign(await req.json())});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to generate campaign."},{status:400})}}
