/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const Module = require('module');
const path = require('path');

function parseInput() {
  const input = process.argv[2];
  if (!input) {
    throw new Error('缺少 a_bogus 生成参数');
  }

  return JSON.parse(Buffer.from(input, 'base64url').toString('utf8'));
}

function requireReverseModules(reverseDir) {
  const originalLog = console.log;
  console.log = () => {};

  try {
    const projectNodeModules = path.resolve(process.cwd(), 'node_modules');
    const nodePathEntries = (process.env.NODE_PATH || '')
      .split(path.delimiter)
      .filter(Boolean);

    if (!nodePathEntries.includes(projectNodeModules)) {
      process.env.NODE_PATH = [projectNodeModules, ...nodePathEntries].join(path.delimiter);
      Module._initPaths();
    }

    globalThis.XMLHttpRequest = function XMLHttpRequest() {};
    require(path.join(reverseDir, 'env.js'));
    require(path.join(reverseDir, 'bdms.js'));
  } finally {
    console.log = originalLog;
  }
}

function buildInvokeList(payload) {
  const { method, requestPath, body, headers } = payload;
  const invokeList = [
    {
      args: [method, requestPath, true],
    },
  ];

  if (method === 'POST') {
    invokeList.push({
      args: ['Content-Type', 'application/json'],
    });
  }

  invokeList.push(
    {
      args: ['Accept', 'application/json, text/plain, */*'],
    },
    {
      args: ['appid', headers.appid],
    },
    {
      args: ['adUserId', headers.aduserid],
    },
    {
      args: ['apptype', headers.apptype],
    },
    {
      args: ['distributorId', headers.distributorid],
    },
    {
      args: ['Agw-Js-Conv', headers.agwJsConv],
    }
  );

  return {
    invokeList,
    body: method === 'POST' ? JSON.stringify(body ?? {}) : null,
  };
}

function generateABogus(payload) {
  const reverseDirCandidates = [
    process.env.CHANGDU_REVERSE_DIR,
    '/Users/wuchao/Documents/code/reverse/changdu',
  ].filter(Boolean);
  const reverseDir = reverseDirCandidates.find(candidate => {
    return (
      fs.existsSync(path.join(candidate, 'env.js')) &&
      fs.existsSync(path.join(candidate, 'bdms.js'))
    );
  });

  if (!reverseDir) {
    throw new Error(
      `未找到可用的常读逆向目录，请配置 CHANGDU_REVERSE_DIR。已检查路径: ${reverseDirCandidates.join(', ')}`
    );
  }

  requireReverseModules(reverseDir);

  const xhr = new XMLHttpRequest();
  const { invokeList, body } = buildInvokeList(payload);
  xhr.bdmsInvokeList = invokeList;
  xhr.send(body);

  const aBogus = globalThis.window?.a_bogus;
  if (!aBogus) {
    throw new Error('生成 a_bogus 失败');
  }

  return {
    aBogus,
    encodedABogus: encodeURIComponent(aBogus),
  };
}

function main() {
  const payload = parseInput();
  const result = generateABogus(payload);
  process.stdout.write(JSON.stringify(result));
}

main();
