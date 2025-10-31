#!/bin/bash
# Helper script pre spúšťanie špecifických testov

echo "🧪 bg-mcp-shell Test Runner"
echo "=============================="
echo ""

if [ -z "$1" ]; then
  echo "Použitie:"
  echo ""
  echo "  tests/tests-run.sh all                    # Všetky testy"
  echo "  tests/tests-run.sh unit                   # Len unit testy"
  echo "  tests/tests-run.sh integration            # Len integračné testy"
  echo "  tests/tests-run.sh file <filename>        # Konkrétny súbor"
  echo "  tests/tests-run.sh func <function>        # Konkrétna funkcia/pattern"
  echo "  tests/tests-run.sh watch                  # Watch mode"
  echo ""
  echo "Príklady:"
  echo "  tests/tests-run.sh func listSessions"
  echo "  tests/tests-run.sh func 'should return empty'"
  echo "  tests/tests-run.sh file sessions.test.js"
  exit 0
fi

case "$1" in
  all)
    echo "▶️  Spúšťam všetky testy..."
    npm test
    ;;
  
  unit)
    echo "▶️  Spúšťam unit testy..."
    npm run test:unit
    ;;
  
  integration)
    echo "▶️  Spúšťam integračné testy..."
    npm run test:integration
    ;;
  
  file)
    if [ -z "$2" ]; then
      echo "❌ Musíš zadať názov súboru!"
      exit 1
    fi
    
    # Nájdi súbor
    if [[ "$2" == *".test.js" ]]; then
      FILE=$(find . -name "$2" | head -1)
    else
      FILE=$(find . -name "$2.test.js" | head -1)
    fi
    
    if [ -z "$FILE" ]; then
      echo "❌ Súbor nenájdený: $2"
      echo "Dostupné test súbory:"
      find . -name "*.test.js" -type f | sed 's/\.\//  - /'
      exit 1
    fi
    
    echo "▶️  Spúšťam: $FILE"
    node --test --test-reporter=spec "$FILE"
    ;;
  
  func|function|pattern)
    if [ -z "$2" ]; then
      echo "❌ Musíš zadať názov funkcie alebo pattern!"
      exit 1
    fi
    
    echo "▶️  Hľadám testy obsahujúce: '$2'"
    node --test --test-reporter=spec --test-name-pattern="$2" ./**/*.test.js
    ;;
  
  watch)
    echo "▶️  Spúšťam watch mode..."
    npm run test:watch
    ;;
  
  *)
    echo "❌ Neznámy príkaz: $1"
    echo "Použite 'tests/tests-run.sh' pre help."
    exit 1
    ;;
esac
