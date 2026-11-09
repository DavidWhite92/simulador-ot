export default function TablePerson({ person }) {
  return <><td style={{width:31,minWidth:31,padding:0,border:'1px solid #ddd'}}><img src={person.photo || '/ot_photos/sinfoto.gif'} alt="" width={31} height={31} style={{width:31,height:31,objectFit:'cover',display:'block',maxWidth:'none'}} /></td><th scope="row" style={{padding:'0 6px',border:'1px solid #ddd',textAlign:'center',whiteSpace:'nowrap',fontWeight:'inherit'}}>{person.name}</th></>;
}
