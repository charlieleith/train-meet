import TrainMeet, { type Services, type Stations } from "./TrainMeet";
import servicesJson from "../public/data/direct_services.json";
import stationsJson from "../public/data/stations.json";

const stations = stationsJson as unknown as Stations;
const services = servicesJson as unknown as Services;

export default function Page() {
  return (
    <main>
      <h1>Train Meet</h1>
      <p className="lede">
        Pick two UK stations. We&apos;ll show you whether a direct train runs,
        and which stations are reachable directly from both — your one-change
        meeting points.
      </p>
      <TrainMeet stations={stations} services={services} />
      <footer>
        <p>
          <small>Timetable data from National Rail / RDG. Rebuilt weekly.</small>
        </p>
      </footer>
    </main>
  );
}
