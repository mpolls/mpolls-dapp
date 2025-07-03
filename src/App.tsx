import { bytesToStr, JsonRPCClient } from "@massalabs/massa-web3";
import { useEffect, useState } from "react";
import { MassaLogo } from "@massalabs/react-ui-kit";
import PollsApp from './PollsApp';
import './App.css';

const sc_addr = "AS12jYTN2iddXPrUruw65M7imA9nfDaGozXGjtPoi5b456EzegSSa"; // TODO Update with your deployed contract address

/**
 * The key used to store the greeting in the smart contract
 */
const GREETING_KEY = "greeting_key";

/**
 * App component that handles interactions with a Massa smart contract
 * @returns The rendered component
 */
function App() {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [showPolls, setShowPolls] = useState(false);

  /**
   * Initialize the web3 client
   */
  const client = JsonRPCClient.buildnet()

  /**
   * Fetch the greeting when the web3 client is initialized
   */
  useEffect(() => {
    getGreeting();
  });

  /**
   * Function to get the current greeting from the smart contract
   */
  async function getGreeting() {
    if (client) {
      const dataStoreVal = await client.getDatastoreEntry(GREETING_KEY, sc_addr, false)
      const greetingDecoded = dataStoreVal ? bytesToStr(dataStoreVal) : null;
      setGreeting(greetingDecoded);
    }
  }

  return (
    <>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <MassaLogo className="logo" size={100} />
        <h1>Massa dApp Demo</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setShowPolls(!showPolls)}
            style={{
              padding: '10px 20px',
              backgroundColor: showPolls ? '#666' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              margin: '0 10px'
            }}
          >
            {showPolls ? 'Show Hello World' : 'Show Polls App'}
          </button>
        </div>

        {showPolls ? (
          <PollsApp />
        ) : (
          <div>
            <h2>Greeting message:</h2>
            <h1>{greeting}</h1>
          </div>
        )}
      </div>
    </>
  );
}

export default App;



