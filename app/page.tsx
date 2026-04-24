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
        Pick two or more UK stations. We&apos;ll show you the stations reachable
        within a few changes from all of them — your meeting points.
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
