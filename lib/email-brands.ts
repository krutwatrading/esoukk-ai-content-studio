export type EmailBrand="kavia"|"esoukk";

export const EMAIL_BRANDS={
 kavia:{label:"KAVIA",senderEnv:"RESEND_KAVIA_FROM_EMAIL",replyEnv:"RESEND_KAVIA_REPLY_TO",accent:"#173d27"},
 esoukk:{label:"eSoukk",senderEnv:"RESEND_ESOUKK_FROM_EMAIL",replyEnv:"RESEND_ESOUKK_REPLY_TO",accent:"#8a6827"},
}as const;

export function emailBrandConfig(brand:EmailBrand){
 const definition=EMAIL_BRANDS[brand];
 const sender=process.env[definition.senderEnv]?.trim()||(brand==="kavia"?process.env.RESEND_FROM_EMAIL?.trim():"")||"";
 return{...definition,sender,replyTo:process.env[definition.replyEnv]?.trim()||""};
}

export const parseEmailBrand=(value:unknown):EmailBrand=>value==="esoukk"?"esoukk":"kavia";
