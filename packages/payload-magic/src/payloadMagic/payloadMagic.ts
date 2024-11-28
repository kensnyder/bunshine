import bodyParser from '../bodyParser/bodyParser';
import cookieParser from '../cookieParser/cookieParser';
import queryParser from '../queryParser/queryParser';

export default function payloadMagic() {
  return [cookieParser(), queryParser(), bodyParser()];
}
