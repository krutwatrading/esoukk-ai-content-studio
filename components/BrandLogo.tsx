import Image from "next/image";

export default function BrandLogo({className=""}:{className?:string}){
  return <Image className={`kavia-logo ${className}`} src="/brand/kavia-logo.png" alt="KAVIA — Elevate Your Everyday" width={1656} height={960} priority/>;
}
