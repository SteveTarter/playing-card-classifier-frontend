import React, { useState } from "react";
import { Container, Card } from "react-bootstrap";
import NavBar from "./NavBar"
import CardClassifier from "./CardClassifier";

function App() {
  const [activeSection, setActiveSection] = useState('');

  const selectActiveSelection = (section) => {
    if (section === activeSection) {
      setActiveSection('');
    }
    else {
      setActiveSection(section);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <NavBar onSelect={selectActiveSelection} />
      <CardClassifier />
      <hr />
      {activeSection === 'directions' && <Directions />}
      {activeSection === 'about' && <About />}
      {activeSection === 'legal' && <Legal />}
    </div>
  );
}

const Directions = () => {
  return (
    <Container className="py-4">
      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            <h4>Directions</h4>
            <ol>
              <li>
                Take or upload a photo of a playing card.
              </li>
              <li>
                Submit it using the form.
              </li>
              <li>
                In seconds, receive a classification result—learn whether the model
                guessed correctly or needs more training.
              </li>
            </ol>
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
  )
};
const About = () => {
  return (
    <Container className="py-4">
      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            <h4>About</h4>
            This app is the web client interface for the Tarterware Playing‑Card Classifier,
            powered by TensorFlow and crafted after the TensorFlow Developer Certificate –
            Image Classification course. It enables users to upload a card image and get an
            instant prediction of its value and suit—leveraging a custom convolutional neural
            network.  The network trained on a dataset of&nbsp;
            <a href="https://www.kaggle.com/datasets/gpiosenka/cards-image-datasetclassification">
            playing‑card images from Kaggle</a>. The application frontend and backend are hosted
            on Amazon Web Services.  Github hosts both the&nbsp;
            <a href="https://github.com/SteveTarter/playing-card-classifier">backend</a>&nbsp;and
            &nbsp;<a href="https://github.com/SteveTarter/playing-card-classifier-frontend">
            frontend</a>.
            <br/>
            <hr/>
            <h4>Why This App Was Built</h4>
            <ul>
              <li>
                <b>Educational:</b> Demonstrates core ML concepts—image preprocessing, CNN modeling,
                and real‑time prediction.  Demonstrates deployment of the entire system on AWS.
              </li>
              <li>
                <b>Interactive:</b> Users can upload photos of cards and see immediate results—
                providing hands‑on ML experience.
              </li>
              <li>
                <b>Extendable:</b> Future improvements include testing with more edge‑case images
                and expanding the dataset using AI‑generated samples.
              </li>
            </ul>
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
  )
};
const Legal = () => {
  return (
    <Container className="py-4">
      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            <h4>Legal</h4>
            By using this application, you acknowledge and agree to the following:<br/><br/>
            <b>Image Usage for Model Improvement</b><br/>
            When you submit an image of a playing card through this application, that
            image—along with the classifier's predicted result—may be retained and used for
            the purposes of evaluating and improving the underlying machine learning model.
            This includes using submitted data for model retraining, performance analysis, and
            debugging misclassifications. These images will not be used for commercial purposes
            or shared outside the context of model development.<br/><br/>
            <b>No Warranty or Guarantee</b><br/>
            This application is provided “as is” for educational and demonstration purposes.
            While we strive for accuracy, no guarantee is made regarding the correctness of
            predictions or the uninterrupted availability of the service. Users should not rely
            on this tool for any critical or production use.<br/><br/>
            <b>Limitation of Liability</b><br/>
            Under no circumstances shall the developer be liable for any direct, indirect,
            incidental, or consequential damages resulting from the use or inability to use
            the application.<br/><br/>
            <b>Third-Party Services</b><br/>
            This application may interact with third-party services or APIs (e.g., AWS). These
            services operate under their own terms of service and privacy policies. We encourage
            users to review those separately.<br/><br/>
            <b>Privacy and Security</b><br/>
            We do not collect personally identifiable information. However, all data
            transmissions are subject to standard internet security risks. Users should
            avoid submitting sensitive or personal data through the platform.<br/><br/>
            <b>Contact</b><br/>
            For questions or concerns about this legal policy, please contact
            <a href="mailto: steve@tarterware.com">steve@tarterware.com</a>.
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
  )
};

export default App;